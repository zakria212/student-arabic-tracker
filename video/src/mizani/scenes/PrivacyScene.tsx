import React from "react";
import { Interactive, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, useAppear } from "../components";
import { clamp, colors, easeOut } from "../theme";

const Point: React.FC<{ delay: number; text: string }> = ({ delay, text }) => {
  const appear = useAppear(delay);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 30,
        fontSize: 60,
        fontWeight: 500,
        color: colors.paper,
        opacity: appear,
        translate: `${(1 - appear) * -120}px 0px`,
      }}
    >
      <div style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.coral }} />
      {text}
    </div>
  );
};

export const PrivacyScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <Backdrop background={colors.ocean}>
      <Interactive.Div
        name="Lock"
        style={{
          position: "absolute",
          top: 300,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          scale: interpolate(frame, [0, 25], [0.5, 1], {
            ...clamp,
            easing: easeOut,
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [0, 15], [0, 1], clamp),
        }}
      >
        <svg width={260} height={300} viewBox="0 0 260 300">
          <path
            d="M60 130V90a70 70 0 0 1 140 0v40"
            fill="none"
            stroke={colors.blush}
            strokeWidth="26"
            strokeLinecap="round"
          />
          <rect x="20" y="130" width="220" height="160" rx="50" fill={colors.coral} />
          <circle cx="130" cy="200" r="20" fill={colors.paper} />
          <rect x="120" y="205" width="20" height="45" rx="10" fill={colors.paper} />
        </svg>
      </Interactive.Div>

      <Interactive.Div
        name="Privacy title"
        style={{
          position: "absolute",
          top: 720,
          left: 90,
          right: 90,
          textAlign: "center",
          fontSize: 104,
          fontWeight: 700,
          lineHeight: 1.25,
          color: colors.paper,
          opacity: interpolate(frame, [10, 30], [0, 1], { ...clamp, easing: easeOut }),
        }}
      >
        بياناتك
        <br />
        على جهازك فقط
      </Interactive.Div>

      <div
        style={{
          position: "absolute",
          top: 1150,
          right: 150,
          left: 150,
          display: "flex",
          flexDirection: "column",
          gap: 44,
        }}
      >
        <Point delay={30} text="بلا حساب ولا تسجيل" />
        <Point delay={40} text="يعمل دون إنترنت" />
        <Point delay={50} text="نسخة احتياطية بضغطة" />
      </div>
    </Backdrop>
  );
};
