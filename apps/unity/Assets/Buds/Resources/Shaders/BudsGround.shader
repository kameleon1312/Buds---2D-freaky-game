// The ground of every map (WorldView ground layers): the layer's colour (vertex colour) times its material's surface
// (GroundLook: grass blades, slabs, grain…), with large soft patches laid over the world (_BudsMacro, a tiling noise set
// once for the whole game) so a park or a beach never reads as one flat colour: a little lighter and warmer here, darker
// and cooler there. The ground is also held a little less saturated than what stands on it, so props and characters
// read clearly against it.
Shader "Buds/Ground"
{
    Properties
    {
        _MainTex ("Surface", 2D) = "white" {}
        _Macro ("Patch strength", Float) = 0.17
        _MacroScale ("Patch scale (per surface tile)", Float) = 0.2
        _Desat ("Desaturate", Float) = 0.12
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
                float _Macro;
                float _MacroScale;
                float _Desat;
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
                half3 surface = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, i.uv).rgb;
                half3 col = surface * i.color.rgb;
                // two octaves of soft patches in world space (uv is world / span), never lined up with the surface
                half m = SAMPLE_TEXTURE2D(_BudsMacro, sampler_BudsMacro, i.uv * _MacroScale).r * 0.65h
                       + SAMPLE_TEXTURE2D(_BudsMacro, sampler_BudsMacro, i.uv * _MacroScale * 2.7h + 0.37h).r * 0.35h - 0.5h;
                col *= 1.0h + m * _Macro * 2.0h;
                col += half3(m, m * 0.45h, -m * 0.6h) * _Macro * 0.35h; // lighter patches a touch warmer
                half l = dot(col, half3(0.299h, 0.587h, 0.114h));
                col = lerp(col, l.xxx, _Desat);
                return half4(col, i.color.a);
            }
            ENDHLSL
        }
    }
}
