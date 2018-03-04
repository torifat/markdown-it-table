┌─────────┬─────┬─────┬─────┬─────┬─────┐
│ (index) │   0 │   1 │   2 │   3 │   4 │
├─────────┼─────┼─────┼─────┼─────┼─────┤
│ bMarks  │   0 │  23 │  55 │  93 │ 131 │
├─────────┼─────┼─────┼─────┼─────┼─────┤
│ eMarks  │  22 │  54 │  92 │ 130 │ 131 │
├─────────┼─────┼─────┼─────┼─────┼─────┤
│ tShift  │   0 │   0 │   0 │   0 │   0 │
├─────────┼─────┼─────┼─────┼─────┼─────┤
│ sCount  │   0 │   0 │   0 │   0 │   0 │
└─────────┴─────┴─────┴─────┴─────┴─────┘

// bMarks => line begin offsets for fast jumps
// eMarks => line end offsets for fast jumps
// tShift => offsets of the first non-space characters (tabs not expanded)
// sCount => indents for each line (tabs expanded)


| HDR1 | HDR2 | HDR3 |
| ------- | ------- | ------- |
| row1 col1 | row1 col2 | row1 col3 |
| row2 col1 | row2 col2 | row3 col3 |
