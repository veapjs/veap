"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, cn } from "@veap/ui";
import { Icon } from "@iconify/react";
import { useTranslation } from "../../../intl/client";
import { Grip, Trash, UnfoldHorizontal, UnfoldVertical } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { saveUserWidgetsState } from "../../actions";

interface WidgetState {
  id: string;
  enabled: boolean;
  colSpan: number;
  rowSpan?: number;
}

interface SectionHandler {
  setEdit: (edit: boolean) => void;
  revert: () => void;
}

const activeEditSections = new Set<string>();
const sectionHandlers = new Map<string, SectionHandler>();
let listenerCount = 0;

function registerSection(slot: string, handler: SectionHandler) {
  sectionHandlers.set(slot, handler);
  return () => {
    sectionHandlers.delete(slot);
    activeEditSections.delete(slot);
  };
}

function setSectionEditMode(slot: string, edit: boolean) {
  if (edit) {
    activeEditSections.add(slot);
  } else {
    activeEditSections.delete(slot);
  }
  sectionHandlers.get(slot)?.setEdit(edit);
}

function toggleAllSections() {
  const anyActive = activeEditSections.size > 0;
  if (anyActive) {
    for (const [slot, handler] of sectionHandlers.entries()) {
      handler.revert();
      handler.setEdit(false);
    }
    activeEditSections.clear();
  } else {
    for (const [slot, handler] of sectionHandlers.entries()) {
      activeEditSections.add(slot);
      handler.setEdit(true);
    }
  }
}

function closeAllSections() {
  for (const handler of sectionHandlers.values()) {
    handler.revert();
    handler.setEdit(false);
  }
  activeEditSections.clear();
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  const isKeyW = e.key?.toLowerCase() === "w" || e.code === "KeyW";
  const isKeyE = e.key?.toLowerCase() === "e" || e.code === "KeyE";
  // Alt+W, Alt+E, Cmd+W, Ctrl+W, Ctrl+Shift+W
  const isAltShortcut = e.altKey && (isKeyW || isKeyE);
  const isCmdOrCtrlW = (e.metaKey || e.ctrlKey) && isKeyW;

  if (isAltShortcut || isCmdOrCtrlW) {
    const target = e.target as HTMLElement | null;
    const isInputField =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);

    if (isInputField && !e.metaKey && !e.altKey) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    toggleAllSections();
  } else if (e.key === "Escape") {
    if (activeEditSections.size > 0) {
      e.preventDefault();
      closeAllSections();
    }
  }
}

function handleCustomToggle() {
  toggleAllSections();
}

function handleCustomClose() {
  closeAllSections();
}

function attachGlobalListener() {
  listenerCount++;
  if (listenerCount === 1 && typeof window !== "undefined") {
    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("veap:toggle-widgets-edit", handleCustomToggle);
    window.addEventListener("veap:close-widgets-edit", handleCustomClose);
  }
}

function detachGlobalListener() {
  listenerCount = Math.max(0, listenerCount - 1);
  if (listenerCount === 0 && typeof window !== "undefined") {
    window.removeEventListener("keydown", handleGlobalKeyDown);
    window.removeEventListener("veap:toggle-widgets-edit", handleCustomToggle);
    window.removeEventListener("veap:close-widgets-edit", handleCustomClose);
  }
}

function computeInitialState(
  userState: WidgetState[] | null,
  defaultWidgets: {
    id: string;
    name: string;
    component: React.ReactNode;
    defaultColSpan?: number;
    defaultRowSpan?: number;
  }[],
  columns: number,
): WidgetState[] {
  if (userState && userState.length > 0) {
    const defaultMap = new Map(defaultWidgets.map((dw) => [dw.id, dw]));
    const stateMap = new Map(userState.map((w) => [w.id, w]));
    const newState = userState
      .filter((w) => w.id.startsWith("spacer-") || defaultMap.has(w.id))
      .map((w) => {
        const def = defaultMap.get(w.id);
        return {
          ...w,
          colSpan: w.colSpan ?? Math.min(def?.defaultColSpan ?? 1, columns),
          rowSpan: w.rowSpan ?? def?.defaultRowSpan ?? 1,
        };
      });

    for (const w of defaultWidgets) {
      if (!stateMap.has(w.id)) {
        newState.push({
          id: w.id,
          enabled: true,
          colSpan: Math.min(w.defaultColSpan ?? 1, columns),
          rowSpan: w.defaultRowSpan ?? 1,
        });
      }
    }
    return newState;
  } else {
    return defaultWidgets.map((w) => ({
      id: w.id,
      enabled: true,
      colSpan: Math.min(w.defaultColSpan ?? 1, columns),
      rowSpan: w.defaultRowSpan ?? 1,
    }));
  }
}

interface WidgetComposerClientProps {
  slot: string;
  defaultWidgets: {
    id: string;
    name: string;
    component: React.ReactNode;
    defaultColSpan?: number;
    defaultRowSpan?: number;
  }[];
  userState: WidgetState[] | null;
  columns?: number;
}

function SortableWidget({
  id,
  widget,
  isEditMode,
  colSpan,
  rowSpan = 1,
  onToggle,
  onResize,
  onResizeRow,
  maxColumns,
}: {
  id: string;
  widget: any;
  isEditMode: boolean;
  colSpan: number;
  rowSpan?: number;
  onToggle: (id: string) => void;
  onResize: (id: string, newColSpan: number) => void;
  onResizeRow: (id: string, newRowSpan: number) => void;
  maxColumns: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const { t } = useTranslation();

  const isSpacer = id.startsWith("spacer-");

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
    gridColumn: `span ${Math.min(colSpan, maxColumns)} / span ${Math.min(colSpan, maxColumns)}`,
    gridRow: `span ${rowSpan} / span ${rowSpan}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col ${isEditMode ? (isSpacer ? "border-primary/50 bg-primary/5 min-h-[100px] rounded-xl border border-dashed" : "squircle -m-2 rounded-xl border border-dashed p-2") : ""}`}
    >
      {isEditMode && (
        <div className="bg-background squircle absolute -top-3 right-3 z-20 flex items-center gap-1 rounded-lg border p-1 shadow-sm">
          <button
            type="button"
            className="hover:bg-muted cursor-pointer rounded p-1"
            onClick={() => {
              const nextSpan = colSpan >= maxColumns ? 1 : colSpan + 1;
              onResize(id, nextSpan);
            }}
            title={t("widgets.change-width")}
          >
            <UnfoldHorizontal className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="hover:bg-muted cursor-pointer rounded p-1"
            onClick={() => {
              const nextRowSpan = rowSpan >= 4 ? 1 : rowSpan + 1;
              onResizeRow(id, nextRowSpan);
            }}
            title={t("widgets.change-row-span")}
          >
            <UnfoldVertical className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="hover:bg-muted text-destructive cursor-pointer rounded p-1"
            onClick={() => onToggle(id)}
            title={
              isSpacer
                ? t("widgets.remove-spacer")
                : t("widgets.disable-widget")
            }
          >
            <Trash className="h-4 w-4" />
          </button>
          <div
            {...attributes}
            {...listeners}
            className="hover:bg-muted cursor-grab rounded p-1 active:cursor-grabbing"
            title={t("widgets.drag-to-move")}
          >
            <Grip className="h-4 w-4" />
          </div>
        </div>
      )}
      <div
        className={`h-full w-full flex-1 [&>*]:min-h-full [&>*]:w-full ${
          isEditMode ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {widget?.component}
      </div>
    </div>
  );
}

export function WidgetComposerClient({
  slot,
  defaultWidgets,
  userState,
  columns = 4,
}: WidgetComposerClientProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [widgetsState, setWidgetsState] = useState<WidgetState[]>(() =>
    computeInitialState(userState, defaultWidgets, columns),
  );
  const [savedWidgetsState, setSavedWidgetsState] = useState<WidgetState[]>(
    () => computeInitialState(userState, defaultWidgets, columns),
  );
  const [isSaving, setIsSaving] = useState(false);

  const { t } = useTranslation();

  // Initialize state using defaultColSpan and defaultRowSpan when needed
  useEffect(() => {
    const initial = computeInitialState(userState, defaultWidgets, columns);
    setWidgetsState(initial);
    setSavedWidgetsState(initial);
  }, [userState, defaultWidgets, columns]);

  useEffect(() => {
    attachGlobalListener();
    const unsubscribe = registerSection(slot, {
      setEdit: setIsEditMode,
      revert: () => {
        setWidgetsState(savedWidgetsState);
      },
    });

    return () => {
      unsubscribe();
      detachGlobalListener();
    };
  }, [slot, savedWidgetsState]);

  const resetToDefaultLayout = () => {
    setWidgetsState(
      defaultWidgets.map((w) => ({
        id: w.id,
        enabled: true,
        colSpan: Math.min(w.defaultColSpan ?? 1, columns),
        rowSpan: w.defaultRowSpan ?? 1,
      })),
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgetsState((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleWidget = (id: string) => {
    if (id.startsWith("spacer-")) {
      // Remove spacer completely
      setWidgetsState((items) => items.filter((i) => i.id !== id));
    } else {
      setWidgetsState((items) =>
        items.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)),
      );
    }
  };

  const resizeWidget = (id: string, newColSpan: number) => {
    setWidgetsState((items) =>
      items.map((i) => (i.id === id ? { ...i, colSpan: newColSpan } : i)),
    );
  };

  const resizeRowWidget = (id: string, newRowSpan: number) => {
    setWidgetsState((items) =>
      items.map((i) => (i.id === id ? { ...i, rowSpan: newRowSpan } : i)),
    );
  };

  const addSpacer = () => {
    const newId = `spacer-${Date.now()}`;
    setWidgetsState((items) => [
      ...items,
      { id: newId, enabled: true, colSpan: 1, rowSpan: 1 },
    ]);
  };

  const handleCancel = () => {
    setWidgetsState(savedWidgetsState);
    setSectionEditMode(slot, false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveUserWidgetsState(slot, widgetsState);
      setSavedWidgetsState(widgetsState);
      setSectionEditMode(slot, false);
      toast.success(t("widgets.save-success"));
    } catch (_e) {
      toast.error(t("widgets.save-error"));
    } finally {
      setIsSaving(false);
    }
  };

  const enabledWidgets = widgetsState.filter((w) => w.enabled);
  const disabledWidgets = widgetsState.filter(
    (w) => !w.enabled && !w.id.startsWith("spacer-"),
  );

  if (defaultWidgets.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 transition-all duration-200",
        isEditMode &&
          "border-primary/40 bg-primary/[0.02] dark:bg-primary/[0.04] rounded-2xl border-2 border-dashed p-4 shadow-sm",
      )}
    >
      {isEditMode && (
        <div className="border-primary/20 flex flex-wrap items-center justify-between gap-3 border-b border-dashed pb-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Icon
                icon="solar:widget-add-linear"
                className="text-primary h-4 w-4"
              />
              {slot.replace(/-/g, " ")}
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addSpacer}
              className="squircle text-xs"
            >
              <Icon
                icon="solar:programming-linear"
                className="mr-1.5 h-3.5 w-3.5"
              />
              {t("widgets.add-spacer")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaultLayout}
              className="squircle text-xs"
            >
              <Icon icon="solar:restart-bold" className="mr-1.5 h-3.5 w-3.5" />
              {t("widgets.reset-layout")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="squircle text-xs"
            >
              {t("widgets.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="squircle text-xs"
            >
              {isSaving ? t("widgets.saving") : t("widgets.save-layout")}
            </Button>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div
          className="grid grid-cols-1 gap-6 xl:grid-flow-row-dense"
          style={{
            // Small screens: 1 column, large screens: grid layout
            gridTemplateColumns:
              typeof window !== "undefined" && window.innerWidth >= 640
                ? `repeat(${columns}, minmax(0, 1fr))`
                : undefined,
            gridAutoRows:
              typeof window !== "undefined" && window.innerWidth >= 640
                ? "minmax(120px, auto)"
                : undefined,
            gridAutoFlow:
              typeof window !== "undefined" && window.innerWidth >= 640
                ? "row dense"
                : undefined,
          }}
        >
          <SortableContext
            items={enabledWidgets.map((w) => w.id)}
            strategy={rectSortingStrategy}
          >
            {enabledWidgets.map((ws) => {
              const isSpacer = ws.id.startsWith("spacer-");
              const widgetDef = isSpacer
                ? {
                    id: ws.id,
                    name: "Spacer",
                    component: (
                      <div className="invisible h-full min-h-[100px] w-full" />
                    ),
                  }
                : defaultWidgets.find((w) => w.id === ws.id);

              if (!widgetDef) return null;

              return (
                <SortableWidget
                  key={ws.id}
                  id={ws.id}
                  widget={widgetDef}
                  isEditMode={isEditMode}
                  colSpan={ws.colSpan}
                  rowSpan={ws.rowSpan}
                  onToggle={toggleWidget}
                  onResize={resizeWidget}
                  onResizeRow={resizeRowWidget}
                  maxColumns={columns}
                />
              );
            })}
          </SortableContext>
        </div>
      </DndContext>

      {isEditMode && disabledWidgets.length > 0 && (
        <div className="bg-muted/30 mt-4 rounded-xl border p-4">
          <h4 className="mb-3 text-sm font-medium">
            {t("widgets.available-widgets")}
          </h4>
          <div className="flex flex-wrap gap-2">
            {disabledWidgets.map((ws) => {
              const widgetDef = defaultWidgets.find((w) => w.id === ws.id);
              if (!widgetDef) return null;
              return (
                <Button
                  key={ws.id}
                  variant="outline"
                  size="sm"
                  onClick={() => toggleWidget(ws.id)}
                >
                  <Icon
                    icon="solar:add-circle-linear"
                    className="mr-2 h-4 w-4"
                  />
                  {widgetDef.name}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
