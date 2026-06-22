# Invoice Printing Guide - Kanzy Spa

## 📋 Overview

The Kanzy Spa application includes a professional invoice printing system designed specifically for thermal printers used in salons. This guide covers all aspects of invoice generation, printing, and customization.

---

## 🖨️ Thermal Printer Support

### Supported Paper Sizes

| Size | Width | Common Usage |
|:---|:---|:---|
| **80mm** | 3.15 inches | Standard thermal printers |
| **58mm** | 2.28 inches | Compact thermal printers |

### Printer Recommendations

- **Recommended**: Zebra ZM400, Epson TM-T20, Star Micronics
- **Format**: Thermal receipt printers (ESC/POS compatible)
- **Connection**: USB or Network

---

## 📄 Invoice Components

### Header Section
- **Salon Logo**: Automatically included if uploaded
- **Salon Name**: Large, bold text
- **Address**: Full address with postal code
- **Phone**: Contact number
- **CR Number**: Commercial registration number

### Invoice Details
- **Invoice Number**: Unique identifier
- **Date & Time**: Automatically generated
- **Staff Name**: Employee who processed the sale
- **Customer Info**: Name and phone number

### Items Table
| Column | Description |
|:---|:---|
| **Description** | Service/Product name with unit price |
| **Qty** | Quantity purchased |
| **Total** | Line item total |

### Totals Section
- **Subtotal**: Sum of all items
- **Discount**: Applied discount amount
- **Tax**: VAT or sales tax
- **Loyalty Points**: Points used (if applicable)
- **Grand Total**: Final amount in OMR

### QR Code
- **Contains**: Invoice ID, Date, Amount, Salon Name
- **Size**: 60×60 pixels
- **Purpose**: Quick verification and record-keeping

### Footer
- **Thank You Message**: In Arabic and English
- **Invoice ID**: For reference
- **Powered By**: Kanzy branding

---

## 🎯 Printing Instructions

### From POS System

1. **Complete the Sale**
   - Select customer
   - Select employee
   - Add services/products
   - Apply discount (if any)
   - Select payment method

2. **Checkout**
   - Click "Checkout" button
   - Review invoice preview
   - Click "Print Invoice"

3. **Print Dialog**
   - Select printer: Choose your thermal printer
   - Paper size: Select 80mm or 58mm
   - Orientation: Portrait (recommended)
   - Margins: Minimal or None
   - Click "Print"

### Print Settings Optimization

**For 80mm Printers:**
```
Margins: Top 0mm, Bottom 0mm, Left 2mm, Right 2mm
Scale: 100%
Orientation: Portrait
Paper: Custom 80mm × 200mm
```

**For 58mm Printers:**
```
Margins: Top 0mm, Bottom 0mm, Left 1mm, Right 1mm
Scale: 100%
Orientation: Portrait
Paper: Custom 58mm × 200mm
```

---

## 🎨 Invoice Customization

### Salon Information

Update in **Settings → Center Profile**:
- Salon Name
- Address
- Phone Number
- Commercial Registration (CR)
- Logo (Upload image)
- Currency (Default: OMR)

### Invoice Templates

Customize message templates in **Settings → Notifications**:
- Payment confirmation messages
- Appointment reminders
- Loyalty point updates

---

## 💰 Payment Methods

Supported payment methods displayed on invoice:
- **CASH**: Cash payment
- **CARD**: Credit/Debit card
- **TRANSFER**: Bank transfer

---

## 🔐 Invoice Security

### QR Code Verification
Each invoice includes a QR code containing:
- Invoice ID
- Transaction date
- Total amount
- Salon name

Customers can scan to verify authenticity.

### Data Integrity
- Invoices are stored in Supabase
- Automatic backup every 24 hours
- Tamper-proof records

---

## 📊 Invoice Data Structure

```json
{
  "invoice": {
    "id": "inv_123456",
    "serialNumber": "INV-001",
    "date": "2026-06-23T14:30:00Z",
    "totalAmount": 37.000,
    "discount": 5.000,
    "tax": 2.000,
    "paymentMethod": "cash",
    "staffName": "فاطمة"
  },
  "items": [
    {
      "id": "item_1",
      "name": "قص الشعر",
      "price": 15.000,
      "qty": 1
    }
  ],
  "customer": {
    "id": "cust_1",
    "name": "أحمد محمد",
    "phone": "+968 9123 4567"
  },
  "settings": {
    "name": "KANZY SPA",
    "address": "السيب، مسقط",
    "phone": "+968 9414 1330",
    "cr": "OM1234567",
    "currency": "OMR",
    "logoPath": "/logos/kanzy.png"
  }
}
```

---

## 🐛 Troubleshooting

### Issue: Text appears cut off

**Solution**: 
- Adjust margins in print settings
- Reduce font size in browser zoom (Ctrl + -)
- Use 80mm paper size instead of 58mm

### Issue: Arabic text appears reversed

**Solution**:
- Ensure printer supports RTL printing
- Update printer drivers
- Use ESC/POS compatible printer

### Issue: QR code not printing

**Solution**:
- Check printer resolution (minimum 203 DPI)
- Ensure QR code area has no overlapping text
- Test with a different printer

### Issue: Logo not printing

**Solution**:
- Verify logo file is uploaded in Settings
- Check image format (PNG/JPG recommended)
- Ensure image size is under 1MB

---

## 📱 Mobile Printing

### iOS
1. Open invoice in Safari
2. Tap Share → Print
3. Select AirPrint printer
4. Configure settings
5. Tap Print

### Android
1. Open invoice in Chrome
2. Tap Menu → Print
3. Select printer
4. Configure settings
5. Tap Print

### Bluetooth Printers
- Pair printer with device first
- Use native print dialog
- Select paired printer
- Adjust settings as needed

---

## 🔄 Invoice Management

### Viewing Invoices
- **Dashboard**: Recent invoices summary
- **Reports**: Detailed invoice history
- **POS**: Current session invoices

### Exporting Invoices
- **PDF**: Export single invoice as PDF
- **CSV**: Export invoice list for accounting
- **JSON**: Export raw data for integration

### Reprinting Invoices
1. Go to **Reports → Sales**
2. Find the invoice
3. Click "Reprint"
4. Configure print settings
5. Click "Print"

---

## 📈 Invoice Analytics

### Tracked Metrics
- Total invoices generated
- Total revenue
- Average transaction value
- Payment method distribution
- Discount usage
- Loyalty points redeemed

### Reports Available
- Daily sales summary
- Weekly revenue trend
- Monthly performance
- Payment method breakdown
- Top services/products

---

## 🔧 Advanced Configuration

### Custom Receipt Format

Edit `InvoicePrintLayout.tsx` to customize:
- Font sizes
- Spacing
- Colors
- Section order
- Additional fields

### API Integration

Print data available via API:
```
GET /api/invoices/{id}/print
```

Response includes all invoice details for custom printing solutions.

---

## 📞 Support

For printing issues or questions:
1. Check this guide
2. Review printer manual
3. Contact support team
4. Check system logs

---

## 🎓 Best Practices

1. **Test Print**: Always test on your specific printer first
2. **Backup**: Keep digital copies of all invoices
3. **Maintenance**: Clean printer regularly
4. **Paper**: Use quality thermal paper
5. **Alignment**: Ensure printer is level
6. **Settings**: Save optimal print settings as default

---

## 📋 Compliance

### Omani Requirements
- Invoice number and date
- Customer details (if applicable)
- Item descriptions and prices
- Total amount
- Payment method
- Merchant details (name, CR, phone)

### International Standards
- ISO 6093: Thermal paper specifications
- ESC/POS: Printer command standard
- QR Code: ISO/IEC 18004

---

## 📚 Additional Resources

- [Thermal Printer Setup Guide](https://example.com/thermal-setup)
- [Invoice Customization Tutorial](https://example.com/invoice-custom)
- [Troubleshooting Guide](https://example.com/troubleshooting)
- [API Documentation](https://example.com/api-docs)

---

**Last Updated**: June 23, 2026
**Version**: 1.0.0
**Status**: Production Ready
