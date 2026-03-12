import type { ReactNode } from "react";
import { MdIosShare, MdShare } from "react-icons/md";
import { useIsApplePlatform, useIsLandscape } from "../shared/device";

type OrientationGateProps = {
  children: ReactNode;
};

export default function OrientationGate({ children }: OrientationGateProps) {
  const isLandscape = useIsLandscape();
  const isApplePlatform = useIsApplePlatform();

  if (isLandscape) {
    return <>{children}</>;
  }

  return (
    <div className="orientation-screen">
      <div className="orientation-card">
        <div className="orientation-icon" aria-hidden="true" />
        <div className="orientation-title">Поверните устройство</div>
        <div className="orientation-text">
          Для корректной работы переведите телефон в альбомную ориентацию.
        </div>
        <div className="orientation-hint">
          После поворота интерфейс появится автоматически.
        </div>
      </div>

      <div className="orientation-card">
        {isApplePlatform ? (
          <MdIosShare size={36} aria-hidden="true" />
        ) : (
          <MdShare size={36} aria-hidden="true" />
        )}
        <div className="orientation-title">Добавьте на главный экран</div>
        <div className="orientation-text">
          Для полноценного опыта использования добавьте ссылку на главный экран. Нажмите "поделиться", затем выберите "добавить на главный экран".
        </div>
        <div className="orientation-hint">
          После этого откройте приложение с рабочего стола. Оно запустится как полноценное приложение.
        </div>
      </div>
    </div>
  );
}
