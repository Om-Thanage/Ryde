export const points = {
  "tenx-main-gate": "TenX main gate",
  "tenx-auto-stand": "TenX auto stand",
  "station-west-auto-stand": "Station West auto stand",
  "station-west-exit": "Station West exit",
};
export const directions = {
  "to-station": "Thane West Station",
  "to-tenx": "TenX Raymond",
};
export const meetingOptions = {
  "to-station": ["tenx-main-gate", "tenx-auto-stand"],
  "to-tenx": ["station-west-auto-stand", "station-west-exit"],
};
export const indiaDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const timeLabel = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
export const dateLabel = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
