import { Composition, Folder } from "remotion";
import { MIZANI_PROMO_DURATION, MizaniPromo } from "./mizani/MizaniPromo";
import { IntroScene } from "./mizani/scenes/IntroScene";
import { RecordScene } from "./mizani/scenes/RecordScene";
import { ReportsScene } from "./mizani/scenes/ReportsScene";
import { DebtsScene } from "./mizani/scenes/DebtsScene";
import { PrivacyScene } from "./mizani/scenes/PrivacyScene";
import { OutroScene } from "./mizani/scenes/OutroScene";
import { SignatureScene } from "./mizani/scenes/SignatureScene";

const reel = { width: 1080, height: 1920, fps: 30 };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MizaniPromo"
        component={MizaniPromo}
        durationInFrames={MIZANI_PROMO_DURATION}
        {...reel}
      />
      <Folder name="MizaniPromo-Scenes">
        <Composition id="Intro" component={IntroScene} durationInFrames={105} {...reel} />
        <Composition id="Record" component={RecordScene} durationInFrames={135} {...reel} />
        <Composition id="Reports" component={ReportsScene} durationInFrames={135} {...reel} />
        <Composition id="Debts" component={DebtsScene} durationInFrames={135} {...reel} />
        <Composition id="Privacy" component={PrivacyScene} durationInFrames={105} {...reel} />
        <Composition id="Outro" component={OutroScene} durationInFrames={120} {...reel} />
        <Composition id="Signature" component={SignatureScene} durationInFrames={90} {...reel} />
      </Folder>
    </>
  );
};
