/** Pending commands and the relative-time clock belong to this mounted launcher. */
export class LauncherState {
  mounted = true;
  now = $state(Date.now());
  pending = $state<string>();
  error = $state<string>();
  errorFocus = $state<string>();

  dispose(): void {
    this.mounted = false;
  }
}
