import { KPIStrip } from "@/components/command-center/KPIStrip";
import { BreakoutLaunchList } from "@/components/command-center/BreakoutLaunchList";
import { FastestGrowingBrands } from "@/components/command-center/FastestGrowingBrands";
import { EmergingAttributes } from "@/components/command-center/EmergingAttributes";
import { AlertFeed } from "@/components/command-center/AlertFeed";
import { TrendSnapshot } from "@/components/command-center/TrendSnapshot";

export default function CommandCenter() {
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <KPIStrip />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <BreakoutLaunchList />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FastestGrowingBrands />
            <EmergingAttributes />
          </div>
        </div>
        <div className="space-y-5">
          <AlertFeed />
          <TrendSnapshot />
        </div>
      </div>
    </div>
  );
}
