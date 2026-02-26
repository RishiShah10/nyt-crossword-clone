# Crossword Keyboard Controls

This document describes all keyboard controls implemented in the NYT crossword clone.

## Implemented Controls

### Letter Input
- **A-Z keys**: Fill current cell with letter and auto-advance to next cell in current direction
  - Uppercase conversion is automatic
  - Auto-advances to next word if at end of current word
  - Wraps around to first word when reaching the end

### Navigation - Arrow Keys
- **Up Arrow**: Move to cell above (sets direction to DOWN)
- **Down Arrow**: Move to cell below (sets direction to DOWN)
- **Left Arrow**: Move to cell on left (sets direction to ACROSS)
- **Right Arrow**: Move to cell on right (sets direction to ACROSS)
- Automatically skips black squares
- Arrow keys change the active direction based on movement axis

### Navigation - Word-Level
- **Tab**: Jump to first cell of next word (maintains current direction)
- **Shift+Tab**: Jump to first cell of previous word (maintains current direction)
- Wraps around: Tab on last word goes to first word, Shift+Tab on first word goes to last word

### Navigation - Word Boundaries
- **Home**: Jump to first cell of current word
- **End**: Jump to last cell of current word

### Cell Editing
- **Backspace**:
  - If current cell has a letter: Clear current cell
  - If current cell is empty: Move to previous cell and clear it
  - Moves to previous word when at start of current word
- **Delete**: Clear current cell without moving cursor
- Typing a letter in filled cell replaces the letter

### Direction Toggle
- **Space**: Toggle between ACROSS and DOWN for current cell
- **Enter**: Toggle between ACROSS and DOWN for current cell (same as Space)

### Mouse/Touch Input
- **Click on cell**:
  - First click: Select cell, maintaining current direction if valid for that cell
  - Second click on same cell: Toggle direction
- Direction preference is maintained when clicking new cells
- Falls back to opposite direction if current direction not available

## Implementation Details

### Event Handling Flow
1. User presses key → React synthetic keydown event fires on input element
2. Grid's handleKeyDown calls preventDefault() to block onChange from firing
3. Event bubbles to window listener
4. useKeyboard hook processes the event with full navigation logic
5. State updates trigger re-render with new selection/values

### Double-Entry Prevention
- Grid-level handleKeyDown calls preventDefault() on ALL keys
- This prevents input onChange from firing
- All keyboard input is handled exclusively by useKeyboard hook
- Prevents duplicate letters or navigation commands

### Mobile Support
- Input has inputMode="text" for proper mobile keyboard
- Mobile virtual keyboards fire keydown events that useKeyboard processes
- Same behavior as desktop keyboards
- Touch clicking on cells works identically to mouse clicks

## NYT Crossword Parity

✅ **Fully Implemented:**
- Letter entry with auto-advance
- Arrow key navigation (cell-by-cell)
- Tab/Shift+Tab (word-by-word navigation)
- Backspace behavior (clear or move back)
- Delete behavior (clear without moving)
- Space/Enter to toggle direction
- Home/End to jump within word
- Click to select, click again to toggle direction
- Direction preference when selecting new cells

❌ **Not Implemented (Future Enhancements):**
- Rebus mode (multi-letter cells)
- Pencil mode (marking uncertain letters)
- Ctrl+A to select all
- Escape to deselect

## Testing Checklist

- [ ] Type letters and verify auto-advance
- [ ] Arrow keys move correctly and set direction
- [ ] Tab moves to next clue
- [ ] Shift+Tab moves to previous clue
- [ ] Home jumps to word start
- [ ] End jumps to word end
- [ ] Backspace clears or moves back appropriately
- [ ] Delete clears without moving
- [ ] Space toggles direction
- [ ] Enter toggles direction
- [ ] Click selects cell with correct direction
- [ ] Click same cell toggles direction
- [ ] No double-entry when typing quickly
- [ ] Mobile keyboard input works correctly
- [ ] Black squares are properly skipped in all navigation
