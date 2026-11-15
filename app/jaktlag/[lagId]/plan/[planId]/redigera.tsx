import { router, useLocalSearchParams } from "expo-router";
import { useLagData, useSynk } from "@/jaktlag/lager";
import { KraverKonto } from "@/components/jaktlag/KraverKonto";
import { PlanEditor } from "@/components/jaktlag/PlanEditor";
import { Kort } from "@/components/ui/Kort";
import { Rubrikrad, Skarm, TillbakaKnapp } from "@/components/ui/Delar";
import { Txt } from "@/components/ui/Txt";

/**
 * Planeraren: den ansvariga ritar planen på kartan (webben). Laget hålls
 * uppdaterat så att medlemslistan stämmer, men planen läses bara in när
 * skärmen öppnas – det man ritar skrivs inte över av en synk.
 */
export default function RedigeraPlan() {
  return <KraverKonto titel="Planera jakten">{() => <Innehall />}</KraverKonto>;
}

function Innehall() {
  const { lagId, planId } = useLocalSearchParams<{ lagId: string; planId: string }>();
  const data = useLagData(lagId);
  useSynk(lagId, 30000, () => router.replace("/jaktlag"));
  const plan = data?.planer.find((p) => p.id === planId);

  if (!data || !plan || data.lag.minRoll !== "ansvarig") {
    return (
      <Skarm>
        <TillbakaKnapp />
        <Rubrikrad titel="Planera jakten" />
        <Kort>
          <Txt farg="inkMuted">
            {!data ? "Hämtar…" : !plan ? "Planen finns inte längre." : "Bara ansvariga i jaktlaget kan ändra planen."}
          </Txt>
        </Kort>
      </Skarm>
    );
  }
  // key: en annan plan ger en ny planerare med sitt eget arbetsexemplar.
  return <PlanEditor key={plan.id} lagId={lagId} plan={plan} data={data} />;
}
