// Taurus Alpha component library — barrel export.
// Import as: import { Button, Card, Modal } from '$lib/components';

// Atoms
export { default as Button } from './Button.svelte';
export { default as IconButton } from './IconButton.svelte';
export { default as Spinner } from './Spinner.svelte';
export { default as Badge } from './Badge.svelte';
export { default as Chip } from './Chip.svelte';
export { default as StatusDot } from './StatusDot.svelte';
export { default as StatePill } from './StatePill.svelte';
export { default as Kbd } from './Kbd.svelte';
export { default as Divider } from './Divider.svelte';
export { default as Avatar } from './Avatar.svelte';
export { default as Code } from './Code.svelte';
export { default as Skeleton } from './Skeleton.svelte';

// Forms
export { default as Label } from './Label.svelte';
export { default as Field } from './Field.svelte';
export { default as Input } from './Input.svelte';
export { default as Textarea } from './Textarea.svelte';
export { default as Select } from './Select.svelte';
export { default as Combobox } from './Combobox.svelte';
export { default as NumberField } from './NumberField.svelte';
export { default as Checkbox } from './Checkbox.svelte';
export { default as Switch } from './Switch.svelte';
export { default as RadioGroup } from './RadioGroup.svelte';
export { default as Slider } from './Slider.svelte';
export { default as SegmentedControl } from './SegmentedControl.svelte';

// Data / display
export { default as Card } from './Card.svelte';
export { default as Stat } from './Stat.svelte';
export { default as Progress } from './Progress.svelte';
export { default as Table } from './Table.svelte';
export { default as KeyValue } from './KeyValue.svelte';

// Feedback / overlay
export { default as Alert } from './Alert.svelte';
export { default as Banner } from './Banner.svelte';
export { default as Tooltip } from './Tooltip.svelte';
export { default as Modal } from './Modal.svelte';
export { default as Drawer } from './Drawer.svelte';
export { default as Popover } from './Popover.svelte';
export { default as Menu } from './Menu.svelte';
export { default as Toaster } from './Toaster.svelte';

// Navigation / disclosure
export { default as Tabs } from './Tabs.svelte';
export { default as Accordion } from './Accordion.svelte';
export { default as Breadcrumbs } from './Breadcrumbs.svelte';
export { default as Pagination } from './Pagination.svelte';
export { default as Stepper } from './Stepper.svelte';

// Taurus surfaces
export { default as TopBar } from './TopBar.svelte';
export { default as Toolbar } from './Toolbar.svelte';
export { default as InspectorSection } from './InspectorSection.svelte';
export { default as PanelResults } from './PanelResults.svelte';
export { default as PromptBlock } from './PromptBlock.svelte';
export { default as QuarterbackBar } from './QuarterbackBar.svelte';
export { default as EmptyState } from './EmptyState.svelte';
export { default as IdentityHoverCard } from './IdentityHoverCard.svelte';
export { default as MockBadge } from './MockBadge.svelte';

// Types + toast helpers
export type { Tone, Size } from './types';
export { toast, dismiss, toasts } from '$lib/toast';
export type { Toast } from '$lib/toast';
