import React from "react";
import { Img, Interactive, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Backdrop } from "../components";
import { clamp, colors, easeOut } from "../theme";

/** توقيع ختامي: شعار زكريا يُكشف من الأسفل إلى الأعلى ثم يظهر الاسم */
export const SignatureScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Backdrop background={colors.ink}>
      <Interactive.Div
        name="Made by"
        style={{
          position: "absolute",
          top: 300,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 48,
          fontWeight: 400,
          color: colors.blush,
          opacity: interpolate(frame, [0, 20], [0, 1], { ...clamp, easing: easeOut }),
        }}
      >
        من تصميم وتطوير
      </Interactive.Div>

      <Img
        name="Emblem"
        src={staticFile("zakaria-emblem.png")}
        style={{
          position: "absolute",
          top: 460,
          left: 317,
          width: 446,
          height: 900,
          clipPath: `inset(${interpolate(frame, [8, 48], [100, 0], { ...clamp, easing: easeOut })}% 0% 0% 0%)`,
          scale: interpolate(frame, [8, 60], [0.92, 1], {
            ...clamp,
            easing: easeOut,
            output: "perceptual-scale",
          }),
        }}
      />

      <Img
        name="Wordmark"
        src={staticFile("zakaria-wordmark.png")}
        style={{
          position: "absolute",
          top: 1440,
          left: 322,
          width: 436,
          height: 66,
          filter: "brightness(0) invert(1)",
          opacity: interpolate(frame, [40, 60], [0, 0.92], { ...clamp, easing: easeOut }),
          translate: interpolate(frame, [40, 60], ["0px 30px", "0px 0px"], { ...clamp, easing: easeOut }),
        }}
      />
    </Backdrop>
  );
};
