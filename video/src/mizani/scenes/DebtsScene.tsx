import React from "react";
import { Backdrop, SceneTitle, useAppear } from "../components";
import { colors } from "../theme";

const DebtCard: React.FC<{
  delay: number;
  top: number;
  title: string;
  person: string;
  paid: string;
  progress: number;
  color: string;
}> = ({ delay, top, title, person, paid, progress, color }) => {
  const appear = useAppear(delay);
  const fill = useAppear(delay + 15, 35);

  return (
    <div
      style={{
        position: "absolute",
        top,
        right: 90,
        left: 90,
        padding: "56px 60px",
        borderRadius: 70,
        backgroundColor: colors.paper,
        boxShadow: "0 18px 50px rgba(31, 74, 85, 0.10)",
        opacity: appear,
        translate: `0px ${(1 - appear) * 120}px`,
      }}
    >
      <div style={{ fontSize: 44, fontWeight: 500, color }}>{title}</div>
      <div style={{ fontSize: 64, fontWeight: 700, marginTop: 10 }}>{person}</div>
      <div
        style={{
          marginTop: 40,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.blush,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * fill * 100}%`,
            height: "100%",
            borderRadius: 22,
            backgroundColor: color,
          }}
        />
      </div>
      <div style={{ fontSize: 40, color: colors.sage, marginTop: 20 }}>{paid}</div>
    </div>
  );
};

export const DebtsScene: React.FC = () => {
  return (
    <Backdrop>
      <SceneTitle kicker="الديون" kickerColor={colors.rose}>
        لا يضيع حقك
        <br />
        ولا تنسى دينك
      </SceneTitle>

      <DebtCard
        delay={25}
        top={760}
        title="لي عند الناس"
        person="أحمد · 1,500 ر.س"
        paid="سُدّد 1,000 على دفعتين"
        progress={0.67}
        color={colors.sage}
      />
      <DebtCard
        delay={40}
        top={1290}
        title="عليّ للناس"
        person="خالد · 3,000 ر.س"
        paid="موعد السداد بعد 5 أيام"
        progress={0.3}
        color={colors.coral}
      />
    </Backdrop>
  );
};
