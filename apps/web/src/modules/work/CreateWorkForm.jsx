import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "../../hooks/useNotifications";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { useCreateWorkItem, WORK_QUERY_KEY } from "./hooks";
import { intentQueryKey } from "../intents/hooks";
import LocationOptionGroupsEditor from "../location/LocationOptionGroupsEditor";

const DURATION_OPTIONS = [
  5, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240,
];

export default function CreateWorkForm({ intentId }) {
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const createWorkItemMutation = useCreateWorkItem();
  const [newWorkTitle, setNewWorkTitle] = useState("");
  const [newWorkDuration, setNewWorkDuration] = useState(15);
  const [newWorkNotes, setNewWorkNotes] = useState("");
  const [newWorkMode, setNewWorkMode] = useState("remote");
  const [newWorkLocationOptionGroups, setNewWorkLocationOptionGroups] =
    useState([]);
  const [newWorkSelectedOptionGroupIndex, setNewWorkSelectedOptionGroupIndex] =
    useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setNewWorkTitle("");
    setNewWorkDuration(15);
    setNewWorkNotes("");
    setNewWorkMode("remote");
    setNewWorkLocationOptionGroups([]);
    setNewWorkSelectedOptionGroupIndex(0);
  };

  const handleCreateWork = async (event) => {
    event.preventDefault();
    if (!newWorkTitle.trim()) return;

    setIsSubmitting(true);

    try {
      const payload = {
        title: newWorkTitle.trim(),
        durationMinutes: Number(newWorkDuration) || 15,
        notes: newWorkNotes.trim() || undefined,
        intentId,
      };

      if (newWorkMode === "place") {
        if (newWorkLocationOptionGroups.length === 0) {
          notify(
            "Please add at least one location option group for place-based work."
          );
          return;
        }

        payload.locationOptions = newWorkLocationOptionGroups
          .map((group) => ({
            title: group.title?.trim() || undefined,
            locations: group.locations
              .filter((location) => location.name)
              .map((location) => ({
                name: location.name,
                address: location.address,
                latitude: location.latitude,
                longitude: location.longitude,
                placeId: location.placeId,
                provider: location.provider,
              })),
          }))
          .filter((option) => option.locations.length > 0);

        if (payload.locationOptions.length === 0) {
          notify(
            "Please add at least one place to your location option groups."
          );
          return;
        }
      }

      const newWork = await createWorkItemMutation.mutateAsync(payload);

      // The mutation's onSuccess already prepends the raw work item into the
      // ["work"] and ["intent", intentId] caches. If it has location options
      // but no selected one yet, default the selection to the first option
      // here (a display-only default, never sent to the server) so it shows
      // as "Selected" immediately instead of waiting for the user to pick.
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

      resetForm();
    } catch (error) {
      console.error("Failed to create work", error);
      notify("Failed to create work");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLocationOptionGroup = () => {
    const nextIndex = newWorkLocationOptionGroups.length;
    setNewWorkLocationOptionGroups((prev) => [
      ...prev,
      { title: `Option ${nextIndex + 1}`, locations: [] },
    ]);
    setNewWorkSelectedOptionGroupIndex(nextIndex);
  };

  const handleRemoveLocationOptionGroup = (groupIndex) => {
    setNewWorkLocationOptionGroups((prev) =>
      prev.filter((_, index) => index !== groupIndex)
    );
    setNewWorkSelectedOptionGroupIndex((prevSelectedIndex) => {
      if (groupIndex < prevSelectedIndex) {
        return prevSelectedIndex - 1;
      }
      if (groupIndex === prevSelectedIndex) {
        return Math.max(0, prevSelectedIndex - 1);
      }
      return prevSelectedIndex;
    });
  };

  const handleRemoveLocationFromGroup = (groupIndex, locationIndex) => {
    setNewWorkLocationOptionGroups((prev) => {
      const next = [...prev];
      const group = next[groupIndex];
      if (!group) return prev;
      group.locations = group.locations.filter(
        (_, index) => index !== locationIndex
      );
      return next;
    });
  };

  const handleRenameGroup = (groupIndex, title) => {
    setNewWorkLocationOptionGroups((prev) => {
      const next = [...prev];
      next[groupIndex] = { ...next[groupIndex], title };
      return next;
    });
  };

  const handleAddLocationToGroup = (groupIndex, place) => {
    setNewWorkLocationOptionGroups((prev) => {
      const next = [...prev];
      const group = next[groupIndex];
      if (!group) return prev;
      group.locations = [...group.locations, place];
      return next;
    });
  };

  return (
    <Card id="new-work-form" padding="lg" rounded="lg" className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-foreground sm:text-xl">
        Add Work
      </h2>
      <form onSubmit={handleCreateWork} className="space-y-4 sm:space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            What needs to happen?
          </label>
          <input
            value={newWorkTitle}
            onChange={(e) => setNewWorkTitle(e.target.value)}
            className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
            placeholder="Buy ingredients, call electrician, review document"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Notes (optional)
          </label>
          <input
            value={newWorkNotes}
            onChange={(e) => setNewWorkNotes(e.target.value)}
            className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:border-primary focus:ring-primary"
            placeholder="Add context or details"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Duration (optional)
            </label>
            <select
              value={newWorkDuration}
              onChange={(e) => setNewWorkDuration(Number(e.target.value))}
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
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-border bg-surface-alt p-4">
          <div className="text-sm font-medium text-foreground">
            Work location
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-border bg-surface p-4">
              <input
                type="radio"
                name="newWorkMode"
                value="remote"
                checked={newWorkMode === "remote"}
                onChange={() => setNewWorkMode("remote")}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <div className="font-semibold text-foreground">
                  Remote (mobile / laptop)
                </div>
                <div className="text-sm text-muted-foreground">
                  No physical location required.
                </div>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-3xl border border-border bg-surface p-4">
              <input
                type="radio"
                name="newWorkMode"
                value="place"
                checked={newWorkMode === "place"}
                onChange={() => setNewWorkMode("place")}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div>
                <div className="font-semibold text-foreground">
                  Requires one or more places
                </div>
                <div className="text-sm text-muted-foreground">
                  Add location option groups for route-aware work.
                </div>
              </div>
            </label>
          </div>
        </div>

        {newWorkMode === "place" && (
          <div className="space-y-4 rounded-3xl border border-primary/30 bg-primary/5 p-4">
            <LocationOptionGroupsEditor
              groups={newWorkLocationOptionGroups}
              selectedGroupIndex={newWorkSelectedOptionGroupIndex}
              onSelectGroup={setNewWorkSelectedOptionGroupIndex}
              onAddGroup={handleAddLocationOptionGroup}
              onRenameGroup={handleRenameGroup}
              onRemoveGroup={handleRemoveLocationOptionGroup}
              onAddLocationToGroup={handleAddLocationToGroup}
              onRemoveLocationFromGroup={handleRemoveLocationFromGroup}
              addGroupLabel="+ Add Group"
            />
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" size="md" onClick={resetForm}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting || !newWorkTitle.trim()}
          >
            {isSubmitting ? "Adding..." : "Add Work"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
