import React from "react";
import { Interactive, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, Capsule, ScaleLogo } from "../components";
import { clamp, colors, easeOut } from "../theme";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Backdrop>
      <Capsule color={colors.paper} delay={0} left={70} top={260} width={200} height={560} />
      <Capsule color={colors.coral} delay={6} left={310} top={200} width={200} height={560} />
      <Capsule color={colors.sage} delay={12} left={570} top={260} width={200} height={560} />
      <Capsule color={colors.ocean} delay={18} left={810} top={200} width={200} height={560} />

      <Interactive.Div
        name="Logo"
        style={{
          position: "absolute",
          top: 960,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(frame, [30, 50], [0, 1], { ...clamp, easing: easeOut }),
          scale: interpolate(frame, [30, 55], [0.6, 1], {
            ...clamp,
            easing: easeOut,
            output: "perceptual-scale",
          }),
        }}
      >
        <ScaleLogo size={190} />
      </Interactive.Div>

      <Interactive.Div
        name="App name"
        style={{
          position: "absolute",
          top: 1180,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 190,
          fontWeight: 700,
          opacity: interpolate(frame, [42, 62], [0, 1], { ...clamp, easing: easeOut }),
          translate: interpolate(frame, [42, 62], ["0px 50px", "0px 0px"], { ...clamp, easing: easeOut }),
        }}
      >
        ميزاني
      </Interactive.Div>

      <Interactive.Div
        name="Tagline"
        style={{
          position: "absolute",
          top: 1460,
          left: 90,
          right: 90,
          textAlign: "center",
          fontSize: 60,
          fontWeight: 400,
          color: colors.sage,
          opacity: interpolate(frame, [58, 78], [0, 1], { ...clamp, easing: easeOut }),
        }}
      >
        دخلك ومصروفك… بوضوح
      </Interactive.Div>
    </Backdrop>
  );
};
