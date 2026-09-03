// CAPABILITY: directory-invoke — render a directory row as a widget.
// Depends on composition/directory-widget.

import { directoryWidget } from "../compositions/directory-widget.js";

export function renderDirectoryInvoke(row) {
  return directoryWidget(row);
}
