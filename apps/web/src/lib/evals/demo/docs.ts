/**
 * Demo knowledge base for the fictional store "Ali Shoes". Used by "Load demo set" in the
 * dashboard, by the eval CI gate, and by the public evals page. Fictional content, written
 * for this project; every eval case below references these documents only.
 */
export interface DemoDoc {
  name: string;
  text: string;
}

export const DEMO_DOCS: DemoDoc[] = [
  {
    name: "Returns and refunds",
    text: `Returns and refunds at Ali Shoes

Full-price items can be returned within 30 days of delivery for a full refund to the original payment method. Sale items can be returned within 14 days of delivery for store credit only; sale items are not refunded to the original payment method.

To be accepted, shoes must be unworn, with the original box and all tags attached. Shoes that show signs of outdoor wear are not accepted. Try shoes on indoors on a carpet.

How to return: log in to your account, open the order and click "Start a return". We email a prepaid return label within one business day. Returns from Portugal and Spain are free. Returns from other EU countries cost 6 euros, deducted from the refund. We do not accept returns from outside the European Union.

Refunds are processed within 5 business days after the warehouse receives the parcel. Your bank may take up to 10 further days to show the money.

Exchanges: we do not offer direct exchanges. Return the item and place a new order; if the new order is placed within 14 days, use the code EXCHANGE10 for 10% off.

Gift returns: items bought as gifts can be returned by the recipient for store credit within 30 days with the gift receipt.

Faulty items: if an item arrives damaged or develops a fault, contact support@alishoes.example within 48 hours of delivery with photos. Faulty items are refunded or replaced at no cost regardless of the return window.`,
  },
  {
    name: "Shipping and delivery",
    text: `Shipping and delivery at Ali Shoes

We ship from our warehouse in Lisbon, Portugal, Monday to Friday. Orders placed before 14:00 Lisbon time ship the same day.

Standard shipping: Portugal 2 business days, Spain 3 business days, rest of the European Union 4 to 6 business days. Standard shipping is free for orders over 60 euros. Below 60 euros it costs 4.90 euros in Portugal and Spain and 7.90 euros in the rest of the EU.

Express shipping: next business day in Portugal and Spain, 2 business days in the rest of the EU. Express costs 9 euros in Portugal and Spain and 14 euros in the rest of the EU, regardless of order value.

We currently ship only to European Union countries. We do not ship to the United Kingdom, Switzerland, Norway, or outside Europe.

Tracking: every order gets a tracking link by email when it leaves the warehouse. Carriers are CTT in Portugal, Correos Express in Spain and DHL for the rest of the EU.

Delivery attempts: carriers make two delivery attempts. After the second failed attempt the parcel waits at a pickup point for 7 days and is then returned to us. Returned parcels are refunded minus the shipping cost.

Order changes: an order can be cancelled or the address changed within 1 hour of placing it from your account page. After that the order is packed and cannot be changed.

Packaging: all shoes ship in their original shoebox inside a recyclable cardboard outer box. We do not use plastic fillers.`,
  },
  {
    name: "Sizing guide",
    text: `Sizing guide for Ali Shoes

Our shoes use EU sizing. We stock EU sizes 36 to 46 for most styles. Half sizes are available for the Oxford and Loafer lines only.

Fit by line:
- Oxford: true to size. Leather stretches slightly in width after a week of wear.
- Loafer: runs half a size large. Order half a size down from your usual EU size.
- Boot: true to size, with room for thick socks. Available in widths D (standard) and E (wide).
- Sneaker: runs small. Order one full size up from your usual EU size.

Measuring at home: stand on a sheet of paper, trace your foot, and measure heel to longest toe in centimetres. Add 0.5 cm, then use the chart: 23.5 cm = EU 37, 24.0 cm = EU 38, 25.0 cm = EU 39, 25.7 cm = EU 40, 26.3 cm = EU 41, 27.0 cm = EU 42, 27.7 cm = EU 43, 28.3 cm = EU 44, 29.0 cm = EU 45, 29.7 cm = EU 46.

Width: if your foot is wider than 10 cm at the ball, choose width E in the Boot line or go half a size up in other lines.

Children's sizes: we do not sell children's shoes.

Still unsure: order two sizes and return one. Returns from Portugal and Spain are free; see the returns policy for other countries.`,
  },
  {
    name: "Warranty and care",
    text: `Warranty and care at Ali Shoes

Every pair comes with a 12-month warranty against manufacturing defects, counted from the delivery date. Covered: sole separation, stitching failure, broken eyelets, and lining defects. Not covered: normal wear of the sole and heel, scuffs, water damage, damage from improper cleaning, and damage caused by alterations by a third-party cobbler.

To make a warranty claim, email support@alishoes.example with your order number and photos of the defect. We reply within 2 business days. Approved claims are repaired free of charge, or replaced if repair is not possible. Repairs take 10 to 15 business days including shipping.

Resoling: outside the warranty, we offer resoling for the Oxford and Boot lines for 45 euros, including return shipping within Portugal and Spain. Resoling is not available for the Sneaker line.

Care: clean leather with a damp cloth and let shoes dry at room temperature, away from radiators. Apply leather conditioner every two months. Use cedar shoe trees between wears. Suede should be brushed with a suede brush and protected with a spray; do not use water on suede.

Waterproofing: our shoes are water-resistant but not waterproof. Avoid prolonged exposure to rain.`,
  },
];
