/**
 * App icons: Hugeicons, Free Stroke Rounded (@hugeicons/core-free-icons).
 * Every icon in the app comes from here, so swapping one glyph is a one-line change.
 * Colour comes from the text (currentColor). Pass `size` (or width/height) to resize.
 */
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon, Alert02Icon, ArrowDown01Icon, ArrowDown02Icon, ArrowLeft01Icon, ArrowRight01Icon, ArrowUp01Icon,
  ArrowUp02Icon, BubbleChatIcon, Calendar03Icon, CalendarCheckIn01Icon, Cancel01Icon, CheckmarkCircle02Icon,
  CircleIcon, Clock01Icon, ComputerIcon, Delete02Icon, Flag02Icon, Folder01Icon, FolderAddIcon, ImageUpload01Icon, KanbanIcon,
  LeftToRightListBulletIcon, Login03Icon, Logout03Icon, Mail01Icon, Menu01Icon, MinusSignIcon, Moon02Icon, Notification01Icon, PencilEdit01Icon,
  Progress02Icon, SentIcon, Settings01Icon, SheetIcon, Sun03Icon, TaskAdd01Icon, TaskDone01Icon, TextAlignLeftIcon, Tick02Icon, Upload01Icon,
} from '@hugeicons/core-free-icons';

type Glyph = Parameters<typeof HugeiconsIcon>[0]['icon'];
type P = { size?: number; width?: number | string; height?: number | string; strokeWidth?: number; className?: string };

const make = (icon: Glyph) => {
  const C = ({ size, width, height, strokeWidth = 1.5, className }: P) => (
    <HugeiconsIcon icon={icon} size={size ?? Number(width ?? height ?? 18)} strokeWidth={strokeWidth}
      color="currentColor" className={className} aria-hidden="true" />
  );
  return C;
};

// Pages and shell
export const IconBoard = make(KanbanIcon);
export const IconList = make(LeftToRightListBulletIcon);
export const IconCalendar = make(Calendar03Icon);
export const IconClock = make(Clock01Icon);
export const IconTable = make(SheetIcon); // a spreadsheet grid (Table01Icon is a piece of furniture)
export const IconFolder = make(Folder01Icon);
export const IconSun = make(Sun03Icon);
export const IconMoon = make(Moon02Icon);
export const IconLogout = make(Logout03Icon);
export const IconSettings = make(Settings01Icon);
export const IconBell = make(Notification01Icon);
export const IconComputer = make(ComputerIcon);
export const IconPlus = make(Add01Icon);
export const IconChevronUp = make(ArrowUp01Icon);
export const IconMenu = make(Menu01Icon);

// Status and week stats
export const IconTodo = make(CircleIcon);
export const IconDoing = make(Progress02Icon);
export const IconDone = make(CheckmarkCircle02Icon);
export const IconAlert = make(Alert02Icon);

// Task cards
export const IconFlag = make(Flag02Icon);
export const IconComment = make(BubbleChatIcon);
export const IconSubtasks = make(TaskDone01Icon);
export const IconEdit = make(PencilEdit01Icon);
export const IconTrash = make(Delete02Icon);
export const IconDescription = make(TextAlignLeftIcon);
export const IconSend = make(SentIcon);

// Buttons and navigation
export const IconPrev = make(ArrowLeft01Icon);
export const IconNext = make(ArrowRight01Icon);
export const IconChevronDown = make(ArrowDown01Icon);
export const IconChevronRight = make(ArrowRight01Icon);
export const IconSortUp = make(ArrowUp02Icon);
export const IconSortDown = make(ArrowDown02Icon);
export const IconClose = make(Cancel01Icon);
export const IconMinus = make(MinusSignIcon);
export const IconSave = make(Tick02Icon);
export const IconToday = make(CalendarCheckIn01Icon);
export const IconFolderAdd = make(FolderAddIcon);
export const IconUpload = make(ImageUpload01Icon);
export const IconMail = make(Mail01Icon);
export const IconLogin = make(Login03Icon);
export const IconTaskAdd = make(TaskAdd01Icon);
/** iPhone "Share" button, for the Add to Home Screen hint */
export const IconShare = make(Upload01Icon);
