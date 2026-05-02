# QR Builder — User Guide

QR Builder is a free, browser-based QR code generator. It runs entirely on your device — no accounts, no servers, no data collection. Open the page, create your QR code, download it, done.

## Getting Started

Open `index.html` in any modern web browser (Chrome, Safari, Edge, or Firefox). The app loads with an example QR code for `https://example.com` so you can see how it works right away.

If you're hosting this on GitHub Pages, just navigate to your published URL.

## Choosing a Data Type

The first thing you'll see is a dropdown at the top of the controls panel asking "What content are we encoding today?" Pick the type of content your QR code will encode. A short description appears below the dropdown explaining what that type does when scanned. Each type has its own input fields and produces a QR code that devices know how to handle automatically.

### URL
Enter a web address. Must start with `http://` or `https://`. When someone scans this QR code, their phone will open the link in a browser.

### Plain Text
Enter any text you want. Up to 2,953 characters. The scanner will display the text as-is.

### Phone
Enter a phone number. Formats like `+1-555-0123` or `(555) 012-3456` are accepted — digits, spaces, hyphens, parentheses, and an optional leading `+`. Scanning the code will prompt the user to call the number.

### Email
Enter an email address (e.g., `name@example.com`). Scanning opens the device's email app with the address pre-filled.

### SMS
Two fields: a phone number and an optional message body. Scanning opens the device's messaging app with the number and message pre-filled.

### Wi-Fi
Three fields:
- **Network Name (SSID)** — the name of the Wi-Fi network (required)
- **Password** — the network password (leave blank for open networks)
- **Encryption Type** — choose WPA/WPA2, WEP, or None

Scanning this QR code will automatically connect the device to the Wi-Fi network. Great for guest networks, offices, or events.

### vCard (Contact Card)
Six fields for contact information:
- **First Name** and **Last Name** — at least one is required
- **Phone**, **Email**, **Organization**, **Address** — all optional

Scanning saves the contact directly to the phone's address book.

### Geo (Geographic Coordinates)
Two fields:
- **Latitude** — a number between -90 and 90
- **Longitude** — a number between -180 and 180

Scanning opens a map application at the specified location. Useful for directing people to a specific place.

## Customization Options

Below the content input, you'll find several ways to customize how your QR code looks.

### Colors

- **Foreground** — the color of the dark modules (the squares that make up the QR pattern). Default is black.
- **Background** — the color behind the modules. Default is white.
- **Transparent background** — check this box if you want the background to be see-through in the exported image. Useful when placing the QR code on top of a colored surface in a design tool.

Click the color swatch to open your system's color picker.

**Tip:** Keep good contrast between foreground and background. The scan indicator (described below) will warn you if the contrast is too low for reliable scanning.

### Module Style

Controls the shape of the individual squares in the QR code:
- **Square** — standard sharp-cornered modules (default)
- **Rounded** — modules with softly rounded corners for a more modern look

### Corner Eye Style

The three large squares in the corners of every QR code are called "finder patterns" or "eyes." This setting changes their appearance:
- **Square** — standard sharp corners (default)
- **Rounded** — rounded corners on the eye patterns
- **Dot** — the center of each eye is drawn as a circle

### Logo

Upload an image to place in the center of your QR code. This is commonly used for branding — a company logo, app icon, or profile picture.

- **Accepted formats:** PNG, JPEG, or SVG
- **Maximum file size:** 2 MB
- **Maximum dimensions:** 2048 × 2048 pixels
- **Upload methods:** Click "Choose File" to browse, or drag and drop an image onto the upload area

The logo is automatically scaled to cover no more than 30% of the QR code area, with padding added around it so it doesn't overlap the QR modules.

**Important:** Adding a logo covers part of the QR code data. The app will recommend switching to a higher Error Correction level (Q or H) to compensate. If you ignore this, the QR code may not scan reliably.

Click "Remove" to take the logo off.

### Error Correction

QR codes have built-in redundancy that allows them to be read even if part of the code is damaged or obscured (like by a logo). You can choose how much redundancy to include:

| Level | Recovery | Best For |
|-------|----------|----------|
| **L** | 7% | Maximum data capacity, minimal damage tolerance |
| **M** | 15% | Good balance for most uses (default) |
| **Q** | 25% | Recommended when using a logo |
| **H** | 30% | Maximum damage tolerance, smallest data capacity |

Higher error correction means the QR code can survive more damage, but it also makes the code denser (more modules), which can make it harder to scan at small sizes.

### Output Size

Choose the pixel dimensions of the exported image:
- **256 × 256** — small, suitable for digital use
- **512 × 512** — good general-purpose size (default)
- **1024 × 1024** — high quality for print
- **2048 × 2048** — maximum quality for large-format printing

This only affects the downloaded file — the on-screen preview adapts to fit the available space.

### Quiet Zone

The "quiet zone" is the blank margin around the QR code. Scanners need this empty space to detect where the code begins and ends.

- **Default: 4 modules** — this is the standard recommended by the QR code specification
- **Range: 0 to 8 modules**

The scan indicator will warn you if you reduce the quiet zone below 4 modules, and will flag the code as unscannable if you set it to 0.

## Preview and Scan Indicator

The right side of the screen (or below the controls on mobile) shows a live preview of your QR code. It updates automatically as you type or change any setting.

### Scan Indicator

Below the preview, a colored dot and status message tell you whether your QR code is likely to scan correctly:

- 🟢 **Scannable** — everything looks good
- 🟡 **At Risk** — the code will probably scan, but some settings may cause issues (low contrast, small quiet zone, or a large logo with low error correction)
- 🔴 **Unscannable** — the code is unlikely to scan reliably (very low contrast, no quiet zone, or a logo covering too much area)

Warning messages below the indicator explain exactly what the issue is and how to fix it.

## Exporting Your QR Code

Once you're happy with your QR code, you have several ways to get it out of the app.

### Download

Click the **Download** button to save the QR code as a file. Use the dropdown next to the button to choose the format:

- **PNG** — a standard image file. Works everywhere. Exported at 300 DPI for print quality. Best for most uses.
- **SVG** — a scalable vector file. Can be resized to any dimension without losing quality. Best for professional print work or when you need to edit the QR code in a design tool like Illustrator or Figma.

The file is named automatically with a timestamp (e.g., `qrcode-2026-05-02T14-30-00-000Z.png`).

### Copy to Clipboard

Click **Copy to Clipboard** to copy the QR code as a PNG image directly to your clipboard. You can then paste it into an email, document, chat, or design tool.

**Note:** This requires HTTPS (works automatically on GitHub Pages). It may not work when opening the file directly from your computer via `file://`.

### Share

On mobile devices and some desktop browsers, a **Share** button appears. This opens your device's native share menu, letting you send the QR code via AirDrop, Messages, email, or any other sharing method your device supports.

This button only appears when your browser supports the Web Share API.

### Reset

Click **Reset** to clear everything and start over. You'll be asked to confirm first. This restores all settings to their defaults: URL data type, black and white colors, square module style, Error Correction M, 512px size, 4-module quiet zone, no logo.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + D` (or `⌘ + D` on Mac) | Download the QR code |
| `Ctrl + Shift + C` (or `⌘ + Shift + C` on Mac) | Copy to clipboard |
| `?` | Open the keyboard shortcuts help dialog |

Press the ⌨ button in the header to see these shortcuts at any time.

## Privacy

QR Builder runs entirely in your browser. Your data never leaves your device:

- No data is sent to any server
- No cookies, local storage, or tracking
- No account or login required
- After the page loads, the app works offline

When you close the tab, everything is gone — nothing is saved.

## Browser Support

QR Builder works in the latest 2 versions of:
- Google Chrome
- Apple Safari
- Microsoft Edge
- Mozilla Firefox

It works on both desktop and mobile devices. The layout automatically adjusts — controls stack vertically on phones and sit side-by-side on larger screens.

## Dark Mode

The app automatically follows your system's dark mode setting. If your operating system is set to dark mode, QR Builder will use a dark color scheme. The QR code preview always uses the colors you've selected, regardless of the app theme.

## Troubleshooting

**The QR code won't scan:**
- Check the scan indicator for warnings
- Increase the contrast between foreground and background colors
- Increase the quiet zone to at least 4 modules
- If using a logo, switch to Error Correction Q or H
- Try a larger output size

**Copy to clipboard doesn't work:**
- This feature requires HTTPS. If you're opening the file directly from your computer, try hosting it on GitHub Pages instead
- Some older browsers don't support copying images to the clipboard

**The share button doesn't appear:**
- The Share button only shows up on browsers that support the Web Share API (mainly mobile Safari and Chrome on Android)

**The app shows "Something went wrong":**
- Click "Reset Application" to reload with default settings
- If the problem persists, try refreshing the page or clearing your browser cache
