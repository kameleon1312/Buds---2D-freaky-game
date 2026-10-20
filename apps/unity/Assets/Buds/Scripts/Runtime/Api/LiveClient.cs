using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace Buds.Api
{
    /// <summary>
    /// One WebSocket to the live server. Receiving and sending run on worker threads; the game only touches the two
    /// queues (<see cref="Send"/>, <see cref="TryReceive"/>) from the main thread, so nothing Unity-side is ever touched off
    /// it. Any network error ends in <see cref="LiveState.Closed"/> with the close code; the session decides whether
    /// to try again. Never throws into the game.
    /// </summary>
    public sealed class LiveClient : IDisposable
    {
        public enum LiveState
        {
            Connecting,
            Open,
            Closed,
        }

        const int MaxQueued = 64;
        readonly ClientWebSocket ws = new();
        readonly CancellationTokenSource cts = new();
        readonly ConcurrentQueue<string> inbox = new();
        readonly ConcurrentQueue<string> outbox = new();
        readonly SemaphoreSlim pending = new(0);
        int state = (int)LiveState.Connecting;

        public LiveState State => (LiveState)Volatile.Read(ref state);
        /// <summary>The server's close code (0 = the connection just broke).</summary>
        public int CloseCode { get; private set; }

        /// <summary>Connects and sends the hello first; false when it couldn't connect (the client is closed then).</summary>
        public async Task<bool> Connect(Uri url, string hello, int timeoutSeconds = 10)
        {
            try
            {
                ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cts.Token);
                timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
                await ws.ConnectAsync(url, timeout.Token).ConfigureAwait(false);
                Interlocked.Exchange(ref state, (int)LiveState.Open);
                outbox.Enqueue(hello);
                pending.Release();
                _ = Task.Run(ReceiveLoop);
                _ = Task.Run(SendLoop);
                return true;
            }
            catch (Exception e)
            {
                Finish(0, e.Message);
                return false;
            }
        }

        /// <summary>Queues a message (dropped when the connection is not open or the queue is full).</summary>
        public void Send(string json)
        {
            if (State != LiveState.Open || outbox.Count >= MaxQueued) return;
            outbox.Enqueue(json);
            pending.Release();
        }

        public bool TryReceive(out string json) => inbox.TryDequeue(out json);

        async Task ReceiveLoop()
        {
            var buffer = new byte[8192];
            var message = new StringBuilder();
            try
            {
                while (State == LiveState.Open && !cts.IsCancellationRequested)
                {
                    var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), cts.Token).ConfigureAwait(false);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        Finish((int)(ws.CloseStatus ?? 0), ws.CloseStatusDescription);
                        return;
                    }
                    message.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                    if (message.Length > 256 * 1024)
                    {
                        Finish(0, "message too long");
                        return;
                    }
                    if (!result.EndOfMessage) continue;
                    inbox.Enqueue(message.ToString());
                    message.Clear();
                    // a game that stopped reading (paused) must not grow the queue for ever
                    while (inbox.Count > 512 && inbox.TryDequeue(out _)) { }
                }
            }
            catch (Exception e)
            {
                Finish((int)(ws.CloseStatus ?? 0), e.Message);
            }
        }

        async Task SendLoop()
        {
            try
            {
                while (State == LiveState.Open && !cts.IsCancellationRequested)
                {
                    await pending.WaitAsync(cts.Token).ConfigureAwait(false);
                    while (outbox.TryDequeue(out var json))
                    {
                        var bytes = Encoding.UTF8.GetBytes(json);
                        await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cts.Token).ConfigureAwait(false);
                    }
                }
            }
            catch (Exception e)
            {
                Finish((int)(ws.CloseStatus ?? 0), e.Message);
            }
        }

        void Finish(int code, string why)
        {
            if (Interlocked.Exchange(ref state, (int)LiveState.Closed) == (int)LiveState.Closed) return;
            CloseCode = code;
            if (code != 0 && code != 1000 && code != 1001) Debug.Log($"[Live] closed {code}: {why}");
            try
            {
                cts.Cancel();
            }
            catch (ObjectDisposedException)
            {
            }
        }

        /// <summary>Says goodbye (best effort) and stops both loops.</summary>
        public void Dispose()
        {
            try
            {
                // the goodbye first (it needs the socket), then the loops stop
                if (State == LiveState.Open && ws.State == WebSocketState.Open)
                    _ = ws.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
                else ws.Abort();
            }
            catch (Exception)
            {
                // closing a socket that is already gone
            }
            Finish(1000, "bye");
        }
    }
}
