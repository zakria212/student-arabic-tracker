import React from "react";
import { Backdrop, SceneTitle, useAppear } from "../components";
import { colors } from "../theme";

const bars = [
  { label: "سكن", value: 0.92, color: colors.ocean },
  { label: "طعام", value: 0.64, color: colors.coral },
  { label: "فواتير", value: 0.48, color: colors.sage },
  { label: "تعليم", value: 0.36, color: colors.rose },
  { label: "تسوق", value: 0.22, color: colors.ocean },
];

const Bar: React.FC<{ index: number; label: string; value: number; color: string }> = ({
  index,
  label,
  value,
  color,
}) => {
  const grow = useAppear(28 + index * 8, 30);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div
        style={{
          width: 140,
          height: 760,
          borderRadius: 70,
          backgroundColor: "rgba(255, 250, 248, 0.6)",
          display: "flex",
          alignItems: "flex-end",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "100%",
            height: `${value * grow * 100}%`,
            borderRadius: 70,
            backgroundColor: color,
          }}
        />
      </div>
      <div style={{ fontSize: 44, fontWeight: 500 }}>{label}</div>
    </div>
  );
};

export const ReportsScene: React.FC = () => {
  return (
    <Backdrop>
      <SceneTitle kicker="التقارير" kickerColor={colors.sage}>
        اعرف أين
        <br />
        يذهب مالك
      </SceneTitle>

      <div
        style={{
          position: "absolute",
          top: 770,
          right: 90,
          left: 90,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        {bars.map((bar, i) => (
          <Bar key={bar.label} index={i} {...bar} />
        ))}
      </div>
    </Backdrop>
  );
};
