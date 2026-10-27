// Water of every map (how calm, bright and clear it is per district: World/DistrictLook) (WorldView ground layers whose surface is water; the map's bands already go from a foamy rim by
// the shore to deep water in the middle). Two ripple layers drift against each other, so the surface moves without ever
// repeating in an obvious way; where both crest together the sun glints off it (sparkles that flicker); slow swells of
// light roll across; the soft world patches (_BudsMacro) darken and lighten whole stretches like the sky would.
Shader "Buds/Water"
{
    Properties
    {
        _MainTex ("Ripples", 2D) = "white" {}
        _Flow ("Flow speed", Float) = 1
        _Glint ("Glint", Float) = 0.45
        _WebLow ("Between the lines", Float) = 0.96
        _WebHigh ("On the lines", Float) = 1.1
        _Sky ("Light rolling over", Float) = 0.16
        _Tint ("Tint", Color) = (1, 1, 1, 1)
    }

    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" "RenderPipeline" = "UniversalPipeline" "IgnoreProjector" = "True" }
        Blend SrcAlpha OneMinusSrcAlpha
        Cull Off
        ZWrite Off

        Pass
        {
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            TEXTURE2D(_MainTex);
            SAMPLER(sampler_MainTex);
            TEXTURE2D(_BudsMacro);
            SAMPLER(sampler_BudsMacro);

            CBUFFER_START(UnityPerMaterial)
                float4 _MainTex_ST;
                float _Flow;
                float _Glint;
                float _WebLow;
                float _WebHigh;
                float _Sky;
                half4 _Tint;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float2 uv : TEXCOORD0;
                half4 color : COLOR;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 uv : TEXCOORD0;
                half4 color : COLOR;
            };

            Varyings Vert(Attributes input)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                o.uv = input.uv;
                o.color = input.color;
                return o;
            }

            half4 Frag(Varyings i) : SV_Target
            {
                float t = _Time.y * _Flow;
                // the swell: the ripples are pushed a little sideways by a slow wave, so their lines bend
                float2 warp = float2(sin(i.uv.y * 2.3 + t * 0.7), cos(i.uv.x * 1.9 + t * 0.55)) * 0.035;
                float2 uv = i.uv * 0.5; // the web's cells about two tiles across
                half a = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, uv + warp + float2(t * 0.02, t * 0.007)).r;
                half b = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, uv * 1.37 - warp + float2(-t * 0.012, t * 0.017) + 0.41).r;
                // the web of light: where either layer's lines run, a little brighter; where both cross, brightest
                half web = saturate((max(a, b) - 0.9h) * 9.0h);
                half3 col = i.color.rgb * _Tint.rgb * lerp((half)_WebLow, (half)_WebHigh, web);
                // light rolling over whole stretches
                half sky = SAMPLE_TEXTURE2D(_BudsMacro, sampler_BudsMacro, i.uv * 0.12 + float2(t * 0.004, 0)).r - 0.5h;
                col *= 1.0h + sky * (half)_Sky;
                // glints where two crests meet, twinkling
                half crest = saturate((a + b - 1.9h) * 14.0h);
                half twinkle = 0.55h + 0.45h * sin(t * 4.1 + i.uv.x * 23.0 + i.uv.y * 17.0);
                col += crest * twinkle * _Glint;
                return half4(col, i.color.a);
            }
            ENDHLSL
        }
    }
}
