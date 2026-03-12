import type { VRSettings } from "../types";

type SliderProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
};

type SettingsPanelProps = {
  visible: boolean;
  settings: VRSettings;
  updateSettings: (patch: Partial<VRSettings>) => void;
  onClose: () => void;
  onReset: () => void;
};

const Slider = ({
  label,
  min,
  max,
  step,
  value,
  onChange,
  formatValue
}: SliderProps) => {
  return (
    <label className="control">
      <div className="control-header">
        <strong>{label}</strong>
        <span>{formatValue ? formatValue(value) : value.toFixed(3)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
};

export default function SettingsPanel({
  visible,
  settings,
  updateSettings,
  onClose,
  onReset
}: SettingsPanelProps) {
  return (
    <div className={`panel ${visible ? "" : "hidden"}`}>
      <div className="button-row" style={{ marginBottom: 10 }}>
        <button className="ghost" onClick={onClose}>Закрыть</button>
        <button className="ghost" onClick={onReset}>Сброс</button>
      </div>

      <div className="section-title">Фильтры</div>
      <div className="button-row">
        <button
          className={settings.filterMode === "none" ? "toggle-active" : "ghost"}
          onClick={() => updateSettings({ filterMode: "none" })}
        >
          Без фильтра
        </button>
        <button
          className={settings.filterMode === "amber" ? "toggle-active" : "ghost"}
          onClick={() => updateSettings({ filterMode: "amber" })}
        >
          Желто-черный
        </button>
        <button
          className={settings.filterMode === "deepblue" ? "toggle-active" : "ghost"}
          onClick={() => updateSettings({ filterMode: "deepblue" })}
        >
          Темно-сине-белый
        </button>
        <button
          className={settings.filterMode === "edge" ? "toggle-active" : "ghost"}
          onClick={() => updateSettings({ filterMode: "edge" })}
        >
          Контурная резкость
        </button>
      </div>

      <div className="section-title">Эффекты</div>
      <div className="button-row">
        <button
          className={settings.distortionEnabled ? "toggle-active" : "ghost"}
          onClick={() => updateSettings({ distortionEnabled: !settings.distortionEnabled })}
        >
          Дисторсия
        </button>
        <button
          className={settings.magnifierEnabled ? "toggle-active" : "ghost"}
          onClick={() => updateSettings({ magnifierEnabled: !settings.magnifierEnabled })}
        >
          Лупа
        </button>
        <button
          className={settings.calibration ? "toggle-active" : "ghost"}
          onClick={() => updateSettings({ calibration: !settings.calibration })}
        >
          Сетка
        </button>
      </div>

      <div className="section-title">Изображение</div>
      <div className="controls">
        <Slider
          label="Контраст"
          min={0.5}
          max={2}
          step={0.01}
          value={settings.contrast}
          onChange={(value) => updateSettings({ contrast: value })}
        />
        <Slider
          label="Яркость"
          min={-0.5}
          max={0.5}
          step={0.01}
          value={settings.brightness}
          onChange={(value) => updateSettings({ brightness: value })}
        />
        <Slider
          label="Гамма"
          min={0.5}
          max={2.5}
          step={0.01}
          value={settings.gamma}
          onChange={(value) => updateSettings({ gamma: value })}
        />
        <Slider
          label="Температура"
          min={-1}
          max={1}
          step={0.01}
          value={settings.temperature}
          onChange={(value) => updateSettings({ temperature: value })}
        />
        <Slider
          label="Светлые участки"
          min={-1}
          max={1}
          step={0.01}
          value={settings.highlights}
          onChange={(value) => updateSettings({ highlights: value })}
        />
        <Slider
          label="Тени"
          min={-1}
          max={1}
          step={0.01}
          value={settings.shadows}
          onChange={(value) => updateSettings({ shadows: value })}
        />
      </div>

      <div className="section-title">Выравнивание глаз</div>
      <div className="controls">
        <Slider
          label="Левый сдвиг X"
          min={-0.2}
          max={0.2}
          step={0.001}
          value={settings.leftOffsetX}
          onChange={(value) => updateSettings({ leftOffsetX: value })}
        />
        <Slider
          label="Правый сдвиг X"
          min={-0.2}
          max={0.2}
          step={0.001}
          value={settings.rightOffsetX}
          onChange={(value) => updateSettings({ rightOffsetX: value })}
        />
        <Slider
          label="Масштаб"
          min={1}
          max={3}
          step={0.01}
          value={settings.scale}
          onChange={(value) => updateSettings({ scale: value })}
        />
        <Slider
          label="Межзрачковое смещение"
          min={-0.1}
          max={0.1}
          step={0.001}
          value={settings.separation}
          onChange={(value) => updateSettings({ separation: value })}
        />
      </div>

      <div className="section-title">Дисторсия</div>
      <div className="controls">
        <Slider
          label="k1 (0-100)"
          min={0}
          max={100}
          step={1}
          value={settings.k1}
          onChange={(value) => updateSettings({ k1: value })}
          formatValue={(value) => value.toFixed(0)}
        />
        <Slider
          label="k2 (0-100)"
          min={0}
          max={100}
          step={1}
          value={settings.k2}
          onChange={(value) => updateSettings({ k2: value })}
          formatValue={(value) => value.toFixed(0)}
        />
        <Slider
          label="Сферизация"
          min={0}
          max={100}
          step={1}
          value={settings.sphereStrength}
          onChange={(value) => updateSettings({ sphereStrength: value })}
          formatValue={(value) => value.toFixed(0)}
        />
        <Slider
          label="Диаметр сферы"
          min={0}
          max={100}
          step={1}
          value={settings.sphereDiameter}
          onChange={(value) => updateSettings({ sphereDiameter: value })}
          formatValue={(value) => value.toFixed(0)}
        />
      </div>

      <div className="section-title">Лупа</div>
      <div className="controls">
        <Slider
          label="Увеличение лупы"
          min={1}
          max={10}
          step={0.01}
          value={settings.magnifierZoom}
          onChange={(value) => updateSettings({ magnifierZoom: value })}
        />
        <Slider
          label="Размер лупы"
          min={0.2}
          max={1}
          step={0.01}
          value={settings.magnifierSize}
          onChange={(value) => updateSettings({ magnifierSize: value })}
        />
      </div>

      <div className="section-title">Советы</div>
      <div className="notice">
        Эти настройки общие для очков, книг и фильмов. Изменения сохраняются между запусками.
      </div>
    </div>
  );
}
