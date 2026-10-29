import React from "react";
import { Backdrop, SceneTitle, useAppear } from "../components";
import { colors } from "../theme";

const TransactionCard: React.FC<{
  delay: number;
  title: string;
  meta: string;
  amount: string;
  income: boolean;
  top: number;
}> = ({ delay, title, meta, amount, income, top }) => {
  const appear = useAppear(delay);
  const accent = income ? colors.sage : colors.coral;

  return (
    <div
      style={{
        position: "absolute",
        top,
        right: 90,
        left: 90,
        height: 190,
        borderRadius: 95,
        backgroundColor: colors.paper,
        boxShadow: "0 18px 50px rgba(31, 74, 85, 0.10)",
        display: "flex",
        alignItems: "center",
        padding: "0 50px",
        gap: 36,
        opacity: appear,
        translate: `${(1 - appear) * -300}px 0px`,
      }}
    >
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: accent,
          color: "white",
          fontSize: 70,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {income ? "+" : "−"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 52, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 38, color: colors.rose, marginTop: 4 }}>{meta}</div>
      </div>
      <div style={{ fontSize: 54, fontWeight: 700, color: accent, direction: "ltr" }}>
        {amount}
      </div>
    </div>
  );
};

export const RecordScene: React.FC = () => {
  return (
    <Backdrop>
      <SceneTitle kicker="الحركات" kickerColor={colors.ocean}>
        سجّل كل ريال
        <br />
        في ثوانٍ
      </SceneTitle>

      <TransactionCard delay={25} top={760} title="راتب" meta="العمل · تحويل بنكي" amount="+8,500" income />
      <TransactionCard delay={37} top={990} title="طعام" meta="المنزل · بطاقة" amount="−240" income={false} />
      <TransactionCard delay={49} top={1220} title="فواتير" meta="المنزل · مع صورة الإيصال" amount="−380" income={false} />
      <TransactionCard delay={61} top={1450} title="عمل إضافي" meta="العمل · نقدًا" amount="+1,200" income />
    </Backdrop>
  );
};
