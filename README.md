# XL - Spreadsheet Trainer

A browser based spreadsheet for teaching spreadsheet skills in a controlled
environment. Students log in, build workbooks with multiple worksheets, use a
core set of Excel style functions, format cells, and save their work to a
MySQL database.

Built with React + Vite + JavaScript on the front end, and a plain PHP REST
API talking to MySQL on the back end. Formula evaluation is handled by
HyperFormula; the grid is react-datasheet-grid.

---

## What it does

- **Accounts** - open registration. Users can change their screen name,
  avatar and password. A seeded admin account can promote other users to
  admin, disable accounts, and delete accounts.
- **Workbooks** - each user can keep as many workbooks as they like. A
  workbook holds one or more worksheets shown as tabs.
- **Formulas** - the common 20% of Excel: `SUM`, `AVERAGE`, `COUNT`,
  `COUNTA`, `COUNTIF`, `SUMIF`, `IF`, `IFS`, `IFERROR`, `VLOOKUP`, `HLOOKUP`,
  `INDEX`, `MATCH`, `ROUND`, `MIN`, `MAX`, `LEFT`, `RIGHT`, `MID`, `LEN`,
  `TRIM`, `UPPER`, `LOWER`, `CONCATENATE`, `TODAY`, `NOW`, `DATE`, and more.
  References can point at other sheets, for example `=Prices!B2`.
- **Point and click ranges** - while typing a formula (for example `=SUM(`)
  you can click or drag across cells to drop the reference into the formula,
  then type `)` and press Enter. Escape cancels.
- **Cell formats** - String, Number, Currency, Percentage, Date, Time, Date
  and time. Decimal places, thousands separator and "negatives in red" are
  per cell. The date, time and currency patterns are configurable per
  workbook (default `dd/MM/yyyy HH:mm:ss`, symbol `£`).
- **Cell styling** - background colour and text colour for a cell, a whole
  row or a whole column; bold, italic, underline; font family (from a
  curated Google Fonts list), font size, horizontal alignment, and cell
  borders (outline / all / top / bottom).
- **Column widths and row heights** - drag the border between two column
  letters, or between two row numbers, to resize. Double click a column
  border to fit it to its contents.
- **Merge cells** - select a block and click Merge (for headings). Unmerge
  puts the cells back.
- **Freeze panes** - keep the top row and / or first column in view while
  scrolling.
- **Guides drawer** - a slide out panel on the right with step by step
  guides. A short starter set ships now; the full sequenced course (cells
  and sheets, then COUNT and SUM, then lookup tables and beyond) is planned.

---

## Requirements

- Laragon (or any Apache + PHP 8.1+ + MySQL 8 stack)
- Node.js 18+ and npm
- PHP with the `pdo_mysql` and `fileinfo` extensions (both are on by default
  in Laragon)

---

## Setup

### 1. Database

Import the schema. This creates the `xl` database, the tables, and the
default admin account.

```bash
mysql -u root -p < api/schema.sql
```

Default admin:

| Email            | Password       |
| ---------------- | -------------- |
| `admin@xl.local` | `ChangeMe!123` |

Change that password after the first login (Profile and settings).

### 2. API configuration

Copy the sample config and fill in your database credentials and a JWT
secret.

```bash
cp api/config.sample.json api/config.json
```

```json
{
  "db": { "host": "127.0.0.1", "port": 3306, "name": "xl", "user": "root", "pass": "" },
  "tablePrefix": "xl_",
  "jwt": { "secret": "put-a-long-random-string-here", "issuer": "xl", "ttlSeconds": 604800 },
  "uploads": { "avatarDir": "uploads/avatars", "maxBytes": 1048576,
               "allowedTypes": ["image/png", "image/jpeg", "image/webp", "image/gif"] }
}
```

`api/config.json` is git ignored. If a machine needs its own overrides
without touching the committed file, create `api/config.local.json` with the
same shape; it takes precedence.

**Table prefix.** All tables are prefixed (default `xl_`, so `xl_users` and
`xl_workbooks`) so this database can be shared with other applications. The
PHP side reads the prefix from `tablePrefix` in the config; `schema.sql` uses
the literal `xl_`. If you change the prefix, change both.

### 3. Serve the API with Apache

Point an Apache virtual host at the project so that the `api` folder is
reachable. For example, with a vhost for `http://localhost` whose document
root is this project, the API lives at `http://localhost/api/`.

Check it:

```bash
curl http://localhost/api/
```

You should see `{"service":"xl-api","db":"ok", ...}`.

The `api/.htaccess` file makes sure the `Authorization` header reaches PHP
and blocks direct access to `*.json` and `*.sql` files.

CORS is handled by `api/cors.php`, which is included at the top of every
endpoint. It reflects any `localhost` origin back to the browser, so the
Vite dev server is accepted on whatever port it runs on. Extra production
origins can be listed in `config.json` under `allowedOrigins`.

### 4. Front end

Tell the front end where the API is. Edit `public/config.json`:

```json
{ "apiBaseUrl": "http://localhost/api" }
```

This file is served as a static asset and read once at start up, so a built
copy can be repointed without rebuilding.

Install and run:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### 5. Build for deployment

```bash
npm run build
```

The static site lands in `dist/`. Serve it however you like; it only needs
`config.json` to point at a reachable API.

---

## Project structure

```
D:/xl
  api/                     PHP REST API
    cors.php               shared CORS handler (included first, everywhere)
    config.php             loads config.json / config.local.json
    db.php                 PDO connection
    jwt.php                hand rolled HS256 JWT encode / verify
    auth.php               current_user / require_user / require_admin
    helpers.php            json_input, respond, fail, field, require_method
    schema.sql             database schema + seed admin
    auth/                  register, login, me
    users/                 update_profile, change_password, avatar,
                           list, set_admin, set_active, delete
    workbooks/             list, get, create, save, rename, delete
    uploads/avatars/       uploaded avatar images
  public/
    config.json            runtime front end config (API base URL)
  src/
    cmFloatAd.jsx          Exeter College floating branding banner (every page)
    api/                   axios client + config loader
    context/               AuthContext
    engine/                cellAddress, formats, fonts, formulaEngine,
                           workbookModel, styleCss, formulaRefs
    hooks/                 useElementSize
    components/
      auth/                LoginPage, RegisterPage, RequireAuth
      layout/              AppShell, UserMenu
      workbook/            WorkbooksPage, WorkbookPage, Grid, SheetTabs,
                           FormulaBar, FormatToolbar
      profile/             ProfilePage
      admin/               AdminPage
      help/                HelpDrawer
      common/              Modal, ConfirmDialog
    styles/app.css         the single stylesheet
```

### Workbook document shape

A workbook is stored as one JSON document in `xl_workbooks.document`:

```jsonc
{
  "version": 1,
  "settings": {
    "dateFormat": "dd/MM/yyyy",
    "timeFormat": "HH:mm:ss",
    "dateTimeFormat": "dd/MM/yyyy HH:mm:ss",
    "currencySymbol": "£",
    "currencyDecimals": 2
  },
  "sheets": [
    {
      "id": "s1",
      "name": "Sheet1",
      "rows": 50,
      "cols": 26,
      "cells": {
        "A1": { "v": "Item", "style": { "bold": true, "bg": "#1f7a4d", "color": "#ffffff" } },
        "B2": { "v": "=SUM(B3:B9)", "fmt": "currency", "decimals": 2, "negRed": true }
      },
      "rowStyles": { "3": { "bg": "#e6f2ff" } },
      "colStyles": { "B": { "bold": true } },
      "colWidths": { "A": 140 },
      "rowHeights": { "0": 40 },
      "merges": [[0, 0, 1, 3]],
      "freeze": { "rows": 1, "cols": 0 }
    }
  ]
}
```

Cell fields: `v` (raw entry), `fmt` (format id), `decimals`, `grouping`
(false to hide the thousands separator), `negRed`, and `style` (which may hold
`bold`, `italic`, `underline`, `bg`, `color`, `font`, `size`, `align`, and
`border` - a subset of the string `"trbl"` for the sides to draw). `merges`
entries are `[anchorRow, anchorCol, rowSpan, colSpan]`, all zero based.

`v` is the raw entry (a literal, or a formula starting with `=`). The
displayed value is computed by HyperFormula and then formatted according to
`fmt` and the workbook `settings`.

---

## API reference (brief)

All requests and responses are JSON. Authenticated endpoints expect
`Authorization: Bearer <token>`.

| Method | Path                             | Purpose                          |
| ------ | -------------------------------- | -------------------------------- |
| POST   | `/api/auth/register.php`         | create account, returns token    |
| POST   | `/api/auth/login.php`            | returns token + user             |
| GET    | `/api/auth/me.php`               | current user                     |
| POST   | `/api/users/update_profile.php`  | screen name / preferences        |
| POST   | `/api/users/change_password.php` | change own password              |
| POST   | `/api/users/avatar.php`          | upload avatar (multipart)        |
| GET    | `/api/users/list.php`            | all users (admin)                |
| POST   | `/api/users/set_admin.php`       | promote / demote (admin)         |
| POST   | `/api/users/set_active.php`      | enable / disable (admin)         |
| POST   | `/api/users/delete.php`          | delete account (admin)           |
| GET    | `/api/workbooks/list.php`        | own workbooks (metadata)         |
| GET    | `/api/workbooks/get.php?id=`     | one workbook + document          |
| POST   | `/api/workbooks/create.php`      | new workbook                     |
| POST   | `/api/workbooks/save.php`        | overwrite document               |
| POST   | `/api/workbooks/rename.php`      | rename                           |
| POST   | `/api/workbooks/delete.php`      | delete                           |

An admin cannot remove their own admin rights, disable themselves, or delete
themselves, so the last administrator is always safe.

---

## Notes and limitations

- Renaming a sheet does not rewrite formulas that referenced the old name.
- The guides drawer content is a short starter set, not the full course.
- Row and column counts can be grown from the editor but not shrunk.
- HyperFormula treats the bare words `TRUE` and `FALSE` as named values so
  that, for example, `=VLOOKUP(..., FALSE)` works like it does in Excel.
- Merged cells are a display feature: the block shows as one cell and edits go
  to the top left, but arrow key navigation still steps through the covered
  cells underneath.
- The format toolbar pickers (font, size, borders, value format, scope) are a
  custom dropdown control, not a native `<select>`. A browser painted
  `<select>` list does not appear in every environment, and the custom list
  can preview each font in its own typeface.
- The grid library (react-datasheet-grid) has no native column resize, row
  resize or freeze support; these are layered on top. Column widths are pinned
  with generated CSS so they are reliable, but a column border that is
  scrolled far off screen cannot be grabbed. Freeze panes follow the grid's
  own scroll events.

---

## Licence

Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International. See
[LICENSE](LICENSE), which also covers the third party libraries. Note the
HyperFormula AGPL v3 / commercial dual licence if you redistribute.
