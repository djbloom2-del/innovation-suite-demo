"use client";

import { useState } from "react";
import { KPIStrip } from "@/components/command-center/KPIStrip";
import { CategoryPulse } from "@/components/command-center/CategoryPulse";
import { BreakoutLaunchList } from "@/components/command-center/BreakoutLaunchList";
import { FastestGrowingBrands } from "@/components/command-center/FastestGrowingBrands";
import { EmergingAttributes } from "@/components/command-center/EmergingAttributes";
import { AlertFeed, type AlertItem } from "@/components/command-center/AlertFeed";
import { TrendSnapshot } from "@/components/command-center/TrendSnapshot";
import { LaunchDetailDrawer } from "@/components/launches/LaunchDetailDrawer";
import { AttributeDeepDiveDrawer } from "@/components/command-center/AttributeDeepDiveDrawer";

export default function CommandCenter() {
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <KPIStrip />
      <CategoryPulse />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <BreakoutLaunchList />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FastestGrowingBrands />
            <EmergingAttributes />
          </div>
        </div>
        <div className="space-y-5">
          <AlertFeed onAlertClick={setSelectedAlert} />
          <TrendSnapshot />
        </div>
      </div>

      {/* Alert detail drawers */}
      {selectedAlert?.launch && (
        <LaunchDetailDrawer
          launch={selectedAlert.launch}
          onClose={() => setSelectedAlert(null)}
        />
      )}
      {selectedAlert?.launches && selectedAlert?.ingredientName && (
        <AttributeDeepDiveDrawer
          launches={selectedAlert.launches}
          ingredientName={selectedAlert.ingredientName}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}
