# Text Table Formatting Guide for TinyMCE Editor

## Basic Structure
```
┌────────┬─────────┬─────────┐
│ Header │ Header  │ Header  │
├────────┼─────────┼─────────┤
│ Data   │ Data    │ Data    │
├────────┼─────────┼─────────┤
│ Data   │ Data    │ Data    │
└────────┴─────────┴─────────┘
```

## Key Principles

### 1. **Consistent Border Widths**
- Use the same number of `─` characters for all horizontal borders
- Example: `─────` (5 characters) for all borders

### 2. **Proper Character Alignment**
- `┌` and `┐` for top corners
- `├`, `┼`, `┤` for middle dividers  
- `└` and `┘` for bottom corners
- `│` for vertical borders

### 3. **Cell Content Spacing**
- Center content within cells
- Use consistent padding (spaces) around text
- Example: `│ A       │` (7 spaces after "A")

### 4. **Table Context**
- Add blank lines above and below the table
- This helps Quill render the box-drawing characters properly

## Example Template
```
┌────────┬─────────┬─────────┐
│ Col 1  │ Col 2   │ Col 3   │
├────────┼─────────┼─────────┤
│ Data   │ Data    │ Data    │
├────────┼─────────┼─────────┤
│ Data   │ Data    │ Data    │
└────────┴─────────┴─────────┘
```

## Common Mistakes to Avoid
- ❌ Inconsistent border widths
- ❌ Misaligned divider characters
- ❌ Uneven cell padding
- ❌ No spacing around the table

## Tips for TinyMCE
- Use the table button in the toolbar to create real HTML tables
- For text-based tables, paste them and apply monospace font
- Test rendering in the editor
- Adjust spacing if characters don't align
- Use moderate border widths (not too narrow/thin)
- Keep cell content simple and centered

## Working Example
```
┌────────┬─────────┬─────────┐
│ A      │ B       │ C       │
├────────┼─────────┼─────────┤
│ A      │ B       │ C       │
├────────┼─────────┼─────────┤
│ A(jam) │ B       │ C       │
├────────┼─────────┼─────────┤
│ A      │ B       │         │
└────────┴─────────┴─────────┘
```
