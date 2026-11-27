import React from "react";
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { clamp, colors, easeOut, fontFamily } from "./theme";

/** خلفية وردية ناعمة مع أشرطة الألوان من لوحة الألوان */
export const Backdrop: React.FC<{
  children: React.ReactNode;
  background?: string;
}> = ({ children, background = colors.blush }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: background,
        fontFamily,
        direction: "rtl",
        color: colors.ink,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** حبة (كبسولة) ملونة تنمو من الأسفل، مستوحاة من بطاقات لوحة الألوان */
export const Capsule: React.FC<{
  color: string;
  delay: number;
  left: number;
  top: number;
  width: number;
  height: number;
}> = ({ color, delay, left, top, width, height }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + 30], [0, 1], {
    ...clamp,
    easing: easeOut,
  });

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        borderRadius: width / 2,
        backgroundColor: color,
        border: "10px solid white",
        boxShadow: "0 20px 60px rgba(31, 74, 85, 0.12)",
        opacity: progress,
        translate: `0px ${(1 - progress) * 220}px`,
      }}
    />
  );
};

/** شعار ميزاني (الميزان) بألوان اللوحة */
export const ScaleLogo: React.FC<{ size: number }> = ({ size }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <rect width="512" height="512" rx="112" fill={colors.ink} />
      <path d="M256 120v272" stroke={colors.coral} strokeWidth="22" strokeLinecap="round" />
      <path d="M136 176h240" stroke={colors.paper} strokeWidth="22" strokeLinecap="round" />
      <path d="M136 176l-52 112h104z" fill="none" stroke={colors.sage} strokeWidth="20" strokeLinejoin="round" />
      <path d="M376 176l-52 112h104z" fill="none" stroke={colors.rose} strokeWidth="20" strokeLinejoin="round" />
      <path d="M84 288a52 30 0 0 0 104 0M324 288a52 30 0 0 0 104 0" fill={colors.paper} opacity=".9" />
      <rect x="196" y="384" width="120" height="22" rx="11" fill={colors.coral} />
    </svg>
  );
};

/** عنوان المشهد: يظهر بانزلاق خفيف من الأسفل */
export const SceneTitle: React.FC<{
  children: React.ReactNode;
  kicker: string;
  kickerColor: string;
}> = ({ children, kicker, kickerColor }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: "absolute", top: 230, right: 90, left: 90 }}>
      <Interactive.Div
        name="Kicker"
        style={{
          display: "inline-block",
          padding: "12px 34px",
          borderRadius: 999,
          backgroundColor: kickerColor,
          color: "white",
          fontSize: 44,
          fontWeight: 500,
          opacity: interpolate(frame, [0, 15], [0, 1], { ...clamp, easing: easeOut }),
        }}
      >
        {kicker}
      </Interactive.Div>
      <Interactive.Div
        name="Title"
        style={{
          marginTop: 36,
          fontSize: 104,
          fontWeight: 700,
          lineHeight: 1.25,
          opacity: interpolate(frame, [5, 25], [0, 1], { ...clamp, easing: easeOut }),
          translate: interpolate(frame, [5, 25], ["0px 60px", "0px 0px"], { ...clamp, easing: easeOut }),
        }}
      >
        {children}
      </Interactive.Div>
    </div>
  );
};

/** يعطي قيمة ظهور (0←1) لعنصر يبدأ بعد تأخير */
export const useAppear = (delay: number, duration = 20) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [delay, delay + duration], [0, 1], {
    ...clamp,
    easing: easeOut,
  });
};
