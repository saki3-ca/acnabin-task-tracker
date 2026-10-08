# Tender Agent tab: layout plan

My understanding of the request, for you to confirm before I change any code.

## What I see in your two screenshots

**Manpower tab (the reference).** The page reads top to bottom as one continuous screen:

1. Portal tab bar
2. Count boxes (Active Manpower, Total Monthly Salary, ...)
3. White filter bar (search box, dropdowns, "Showing 73 active members")
4. Maroon banner and table

**Tender Agent tab (today).** It does not read as one screen:

1. Portal tab bar
2. A second card drawn around the whole dashboard, with a visible border and gap (the iframe frame)
3. Inside it, the dashboard's own tab row (Overview, Bank Tenders, ...) **above** the count boxes
4. A separate scrollbar for the iframe, narrower content, emoji icons, extra padding

So switching from Manpower to Tender Agent changes the page layout and spacing, and that is what breaks the smooth feel.

## What you want

Make the Tender Agent tab follow the same order as Manpower:

```
BEFORE (today)                          AFTER (requested)
+-------------------------------+       +-------------------------------+
| Portal tabs                   |       | Portal tabs                   |
| +---------------------------+ |       |                               |
| | Overview Bank NGO IT ...  | |       | [269] [09] [136] [00] [44]    |  count boxes, now on top
| | [269] [09] [136] [00] [44]| |       |                               |
| | Maroon banner + table     | |       | Overview Bank NGO IT News Src |  moved here, where the
| +---------------------------+ |       |                               |  filter bar sits on Manpower
|  (card frame + scrollbar)     |       | Maroon banner + table         |
+-------------------------------+       +-------------------------------+
```

- The six links (Overview, Bank Tenders, NGO Tenders, IT Services, Newspaper & E-Paper, Source Status) move **below** the count boxes.
- They take the place of the Manpower filter bar: a white rounded bar with the same border, radius, padding and spacing.
- The extra card frame around the iframe goes away. The content lines up with the portal's left and right edges, like Manpower.

## How I would do it

1. **Reorder (tender-agent repo, all 6 pages):** move the `nav-tabs` block below the count boxes and restyle it as the white bar. Only the HTML order and CSS change. No data or logic.
2. **Match the portal look:**
   - Use the portal's line icons in place of the emojis, and match its font sizes, active-tab colour and spacing.
   - Drop the iframe's own padding and max-width so the edges match the portal.
3. **Remove the frame (tracker repo):**
   - Take the card border off the iframe.
   - Size the iframe to its content, so there is no second scrollbar and the page scrolls once.
4. **Keep it standalone-safe:** these changes apply only when the dashboard is embedded (the `html.embedded` class I added earlier). Opening the Tender Agent site directly looks exactly as it does today.

## Decisions I'm making unless you say otherwise

| Question | My default |
|---|---|
| Do the sub-links keep the maroon underline for the active one? | Yes, same as the portal tabs |
| The page-specific filter bars on Bank, NGO and IT (search, dropdowns) | Stay where they are, inside the maroon table panel. The new link bar sits above them. |
| Source Status and Newspaper pages | Same treatment as the other five |
| Admin Settings | Stays hidden when embedded, as now |

## One limit to know about

The portal and the Tender Agent are two separate pages. The portal's top tab bar stays fixed, but the sub-links are part of the Tender Agent page, so clicking one reloads the iframe content. The portal tab bar will not flicker. The area below it will refresh briefly.

I can remove that reload by making the dashboard a single page that swaps sections without reloading. That is a larger rewrite of the Tender Agent site, so I would only do it if you want it.
