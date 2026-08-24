import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "../../hooks/useNotifications";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import LocationOptionGroupsEditor from "../location/LocationOptionGroupsEditor";
import { buildLocationOptionGroupsFromWork } from "../location/utils";
import {
  useAddLocationToOption,
  useCreateLocationOption,
  useDeleteLocationOption,
  useRemoveLocationFromOption,
} from "../location/hooks";
import { intentQueryKey } from "../intents/hooks";
import {
  useCreateWorkItem,
  useDeleteWorkItem,
  useUpdateWorkItem,
  WORK_QUERY_KEY,
} from "./hooks";
import {
  WORK_ENERGY_LEVEL_OPTIONS,
  WORK_PRIORITY_OPTIONS,
  WORK_STATUS_OPTIONS,
} from "./utils";

const DURATION_OPTIONS = [
  5, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240,
];

function toLocationPayload(place) {
  return {
    name: place.name,
    address: place.address ?? place.formattedAddress,
    latitude: place.latitude,
    longitude: place.longitude,
    placeId: place.placeId,
    provider: place.provider || "google",
    phoneNumber: place.phoneNumber ?? null,
    rating: place.rating ?? null,
    ratingsCount: place.ratingsCount ?? null,
    openingHoursText: place.openingHoursText ?? null,
    openingPeriods: place.openingPeriods ?? null,
  };
}

// One modal for both creating a new work item and editing an existing one —
// title/notes/duration/status plus its location option group(s). Editing an
// existing group's places persists immediately (matching how it always
// worked); a brand new group only exists locally until Save, same as before.
export default function WorkFormModal({ open, onClose, intentId, work }) {
  const isEditMode = Boolean(work);
  const { notify, confirm } = useNotifications();
  const queryClient = useQueryClient();

  // The parent mounts a fresh WorkFormModal (via a `key` tied to the work
  // item's id, or "new") every time it opens for a different target, so
  // plain useState initializers below always start from the right values —
  // no reset-on-prop-change effect needed.
  const [title, setTitle] = useState(work?.title || "");
  const [notes, setNotes] = useState(work?.notes || "");
  const [duration, setDuration] = useState(work?.durationMinutes || 15);
  const [status, setStatus] = useState(work?.status || "todo");
  const [priority, setPriority] = useState(work?.priority || "medium");
  const [energyLevel, setEnergyLevel] = useState(
    work?.energyLevel || "medium"
  );
  const initialGroups = buildLocationOptionGroupsFromWork(work);
  const [locationOptionGroups, setLocationOptionGroups] = useState(
    initialGroups.length > 0
      ? initialGroups
      : [{ id: null, title: "", locations: [] }]
  );
  const [showAdvancedLocations, setShowAdvancedLocations] = useState(
    initialGroups.length > 1
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const createWorkMutation = useCreateWorkItem();
  const updateWorkMutation = useUpdateWorkItem();
  const deleteWorkMutation = useDeleteWorkItem();
  const createLocationOptionMutation = useCreateLocationOption();
  const addLocationToOptionMutation = useAddLocationToOption();
  const deleteLocationOptionMutation = useDeleteLocationOption();
  const removeLocationFromOptionMutation = useRemoveLocationFromOption();

  const removeGroupAtIndex = (groupIndex) => {
    setLocationOptionGroups((prev) => {
      const next = prev.filter((_, index) => index !== groupIndex);
      return next.length > 0 ? next : [{ id: null, title: "", locations: [] }];
    });
  };

  const handleAddGroup = () => {
    const nextIndex = locationOptionGroups.length;
    setLocationOptionGroups((prev) => [
      ...prev,
      { id: null, title: `Option ${nextIndex + 1}`, locations: [] },
    ]);
    setShowAdvancedLocations(true);
  };

  const handleRenameGroup = (groupIndex, nextTitle) => {
    setLocationOptionGroups((prev) => {
      const next = [...prev];
      next[groupIndex] = { ...next[groupIndex], title: nextTitle };
      return next;
    });
  };

  const handleRemoveGroup = async (groupIndex) => {
    const group = locationOptionGroups[groupIndex];
    if (!group) return;

    if (!group.id || !isEditMode) {
      removeGroupAtIndex(groupIndex);
      return;
    }

    setIsSaving(true);
    try {
      await deleteLocationOptionMutation.mutateAsync({
        workId: work.id,
        optionId: group.id,
      });
      removeGroupAtIndex(groupIndex);
    } catch (error) {
      console.error("Failed to remove location option group", error);
      notify("Failed to remove location option group");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLocationFromGroup = async (groupIndex, locationIndex) => {
    const group = locationOptionGroups[groupIndex];
    const location = group?.locations?.[locationIndex];
    if (!group || !location) return;

    if (!group.id || !location.id || !isEditMode) {
      setLocationOptionGroups((prev) => {
        const next = [...prev];
        next[groupIndex] = {
          ...next[groupIndex],
          locations: next[groupIndex].locations.filter(
            (_, index) => index !== locationIndex
          ),
        };
        return next;
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedOption = await removeLocationFromOptionMutation.mutateAsync({
        workId: work.id,
        optionId: group.id,
        locationId: location.id,
      });
      setLocationOptionGroups((prev) => {
        const next = [...prev];
        next[groupIndex] = {
          ...next[groupIndex],
          locations: updatedOption.locations || [],
        };
        return next;
      });
    } catch (error) {
      console.error("Failed to remove location from group", error);
      notify("Failed to remove location from group");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddLocationToGroup = async (groupIndex, place) => {
    const group = locationOptionGroups[groupIndex];
    if (!group) return;

    const payload = toLocationPayload(place);

    if (!group.id || !isEditMode) {
      setLocationOptionGroups((prev) => {
        const next = [...prev];
        next[groupIndex] = {
          ...next[groupIndex],
          locations: [...next[groupIndex].locations, payload],
        };
        return next;
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedOption = await addLocationToOptionMutation.mutateAsync({
        workId: work.id,
        optionId: group.id,
        data: payload,
      });
      setLocationOptionGroups((prev) => {
        const next = [...prev];
        next[groupIndex] = {
          ...next[groupIndex],
          locations: updatedOption.locations,
        };
        return next;
      });
    } catch (error) {
      console.error("Failed to add location to group", error);
      notify("Failed to add location to group");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectLocationOption = async (optionId) => {
    if (!isEditMode) return;
    try {
      await updateWorkMutation.mutateAsync({
        workId: work.id,
        patch: { selectedLocationOptionId: optionId },
      });
    } catch (error) {
      console.error("Failed to select location option", error);
      notify("Failed to choose location option");
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      notify("Work title is required.");
      return;
    }

    const pendingGroups = locationOptionGroups
      .filter((group) => !group.id)
      .map((group) => ({
        title: group.title?.trim() || undefined,
        locations: group.locations.filter((location) => location.name),
      }))
      .filter((group) => group.locations.length > 0);

    setIsSaving(true);
    try {
      if (isEditMode) {
        await updateWorkMutation.mutateAsync({
          workId: work.id,
          patch: {
            title: nextTitle,
            notes: notes.trim() || null,
            durationMinutes: Number(duration) || 15,
            status,
            priority,
            energyLevel,
          },
        });

        // Any brand-new (not-yet-persisted) location groups added during
        // this edit session are created now, alongside the metadata save.
        for (const group of pendingGroups) {
          await createLocationOptionMutation.mutateAsync({
            workId: work.id,
            data: group,
          });
        }

        onClose();
        return;
      }

      const newWork = await createWorkMutation.mutateAsync({
        title: nextTitle,
        durationMinutes: Number(duration) || 15,
        notes: notes.trim() || undefined,
        intentId,
        priority,
        energyLevel,
        ...(pendingGroups.length > 0 ? { locationOptions: pendingGroups } : {}),
      });

      // Default the selection to the first option (display-only) so it
      // shows as "Selected" immediately instead of waiting for a pick.
      if (
        !newWork.selectedLocationOptionId &&
        newWork.locationOptions?.length
      ) {
        const defaultedWork = {
          ...newWork,
          selectedLocationOptionId: newWork.locationOptions[0].id,
        };
        queryClient.setQueryData(WORK_QUERY_KEY, (previous) =>
          previous?.map((item) =>
            item.id === defaultedWork.id ? defaultedWork : item
          )
        );
        queryClient.setQueryData(
          intentQueryKey(intentId),
          (previous) =>
            previous && {
              ...previous,
              workItems: previous.workItems?.map((item) =>
                item.id === defaultedWork.id ? defaultedWork : item
              ),
            }
        );
      }

      onClose();
    } catch (error) {
      console.error("Failed to save work item", error);
      notify(
        isEditMode
          ? "Unable to update work right now."
          : "Failed to create work"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!work) return;
    const confirmed = await confirm(
      `Delete "${work.title}"? This can't be undone.`,
      { title: "Delete work item?", confirmLabel: "Delete", danger: true }
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteWorkMutation.mutateAsync(work.id);
      onClose();
    } catch (error) {
      console.error("Failed to delete work item", error);
      notify("Failed to delete work item.");
    } finally {
      setIsDeleting(false);
    }
  };

  const hasMultipleOptions = (work?.locationOptions?.length || 0) > 1;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditMode ? "Edit Work" : "Add Work"}
      size="xl"
      footer={
        <>
          {isEditMode && (
            <Button
              variant="danger-outline"
              pill={false}
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="mr-auto"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          )}
          <Button variant="secondary" pill={false} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            pill={false}
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
          >
            {isSaving ? "Saving…" : isEditMode ? "Save changes" : "Add Work"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">
            What needs to happen?
          </span>
          <input
            value={title}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSave(event);
            }}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
            placeholder="Buy ingredients, call electrician, review document"
            className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">
            Notes (optional)
          </span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add context or details"
            className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">
              Duration
            </span>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
            >
              {DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60
                    ? `${minutes} min`
                    : `${minutes / 60} hr${minutes === 60 ? "" : "s"}`}
                </option>
              ))}
            </select>
          </label>

          {isEditMode && (
            <label className="block space-y-1">
              <span className="text-sm font-medium text-foreground">
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
              >
                {WORK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">
              Priority
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
            >
              {WORK_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">
              Energy needed
            </span>
            <select
              value={energyLevel}
              onChange={(e) => setEnergyLevel(e.target.value)}
              className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
            >
              {WORK_ENERGY_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3 rounded-3xl border border-border bg-surface-alt p-4">
          <div className="text-sm font-semibold text-foreground">
            Places to visit
          </div>

          {isEditMode && hasMultipleOptions && (
            <div className="space-y-2">
              {work.locationOptions.map((option, index) => {
                const isSelected = option.id === work.selectedLocationOptionId;
                return (
                  <div
                    key={option.id}
                    className={`rounded-2xl border p-3 ${isSelected ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {option.title || `Option ${index + 1}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {option.locations.length} place
                          {option.locations.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectLocationOption(option.id)}
                        className={`rounded-full min-h-9 px-3 py-1.5 text-xs font-semibold transition ${isSelected ? "border border-primary bg-primary text-primary-foreground" : "border border-border bg-surface text-foreground hover:bg-surface-alt"}`}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <LocationOptionGroupsEditor
            groups={locationOptionGroups}
            selectedGroupIndex={0}
            onSelectGroup={() => {}}
            onAddGroup={handleAddGroup}
            onRenameGroup={handleRenameGroup}
            onRemoveGroup={handleRemoveGroup}
            onAddLocationToGroup={handleAddLocationToGroup}
            onRemoveLocationFromGroup={handleRemoveLocationFromGroup}
            hideGroupManagement={!showAdvancedLocations}
            disabled={isSaving}
            workTitle={title}
            workNotes={notes}
          />
        </div>
      </div>
    </Modal>
  );
}
