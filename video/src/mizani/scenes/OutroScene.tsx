import React from "react";
import { Interactive, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, Capsule, ScaleLogo } from "../components";
import { clamp, colors, easeOut } from "../theme";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Backdrop>
      <Capsule color={colors.coral} delay={0} left={-80} top={1500} width={260} height={700} />
      <Capsule color={colors.sage} delay={6} left={900} top={-200} width={260} height={620} />

      <Interactive.Div
        name="Logo"
        style={{
          position: "absolute",
          top: 520,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(frame, [0, 20], [0, 1], { ...clamp, easing: easeOut }),
          scale: interpolate(frame, [0, 25], [0.7, 1], {
            ...clamp,
            easing: easeOut,
            output: "perceptual-scale",
          }),
        }}
      >
        <ScaleLogo size={240} />
      </Interactive.Div>

      <Interactive.Div
        name="App name"
        style={{
          position: "absolute",
          top: 800,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 170,
          fontWeight: 700,
          opacity: interpolate(frame, [10, 30], [0, 1], { ...clamp, easing: easeOut }),
        }}
      >
        ميزاني
      </Interactive.Div>

      <Interactive.Div
        name="Call to action"
        style={{
          position: "absolute",
          top: 1080,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(frame, [25, 45], [0, 1], { ...clamp, easing: easeOut }),
          translate: interpolate(frame, [25, 45], ["0px 40px", "0px 0px"], { ...clamp, easing: easeOut }),
        }}
      >
        <div
          style={{
            padding: "28px 70px",
            borderRadius: 999,
            backgroundColor: colors.ocean,
            color: colors.paper,
            fontSize: 64,
            fontWeight: 700,
          }}
        >
          مجاني · ثبّته الآن
        </div>
      </Interactive.Div>

      <Interactive.Div
        name="Link"
        style={{
          position: "absolute",
          top: 1290,
          left: 80,
          right: 80,
          textAlign: "center",
          fontSize: 40,
          color: colors.sage,
          direction: "ltr",
          opacity: interpolate(frame, [40, 60], [0, 1], { ...clamp, easing: easeOut }),
        }}
      >
        zakria212.github.io/student-arabic-tracker/app
      </Interactive.Div>
    </Backdrop>
  );
};
