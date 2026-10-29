import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { IntroScene } from "./scenes/IntroScene";
import { RecordScene } from "./scenes/RecordScene";
import { ReportsScene } from "./scenes/ReportsScene";
import { DebtsScene } from "./scenes/DebtsScene";
import { PrivacyScene } from "./scenes/PrivacyScene";
import { OutroScene } from "./scenes/OutroScene";
import { SignatureScene } from "./scenes/SignatureScene";

// 7 مشاهد مجموعها 825 إطارًا، ناقص 6 انتقالات × 15 إطارًا = 735 إطارًا (24.5 ثانية)
export const MIZANI_PROMO_DURATION = 735;

export const MizaniPromo: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Intro" durationInFrames={105}>
      <IntroScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence name="Record" durationInFrames={135}>
      <RecordScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={slide({ direction: "from-left" })}
      timing={linearTiming({ durationInFrames: 15 })}
    />
    <TransitionSeries.Sequence name="Reports" durationInFrames={135}>
      <ReportsScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={slide({ direction: "from-left" })}
      timing={linearTiming({ durationInFrames: 15 })}
    />
    <TransitionSeries.Sequence name="Debts" durationInFrames={135}>
      <DebtsScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence name="Privacy" durationInFrames={105}>
      <PrivacyScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence name="Outro" durationInFrames={120}>
      <OutroScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence name="Signature" durationInFrames={90}>
      <SignatureScene />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
