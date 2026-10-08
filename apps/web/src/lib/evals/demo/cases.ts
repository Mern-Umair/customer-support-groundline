import type { EvalCaseKind } from "../../db/types";

export interface DemoCase {
  kind: EvalCaseKind;
  question: string;
  expectedAnswer?: string;
  expectedSource?: string;
  tags?: string[];
}

/**
 * 40 hand-written cases over the demo docs: 30 answerable (with a reference answer and the
 * document a correct answer must cite) and 10 unanswerable (the documents do not contain
 * the answer; the assistant should refuse). This is the "golden set" for the public numbers.
 */
export const DEMO_CASES: DemoCase[] = [
  // Returns (8)
  { kind: "answerable", question: "How long do I have to return full-price shoes?", expectedAnswer: "30 days from delivery, for a full refund to the original payment method.", expectedSource: "Returns", tags: ["returns"] },
  { kind: "answerable", question: "Can I get my money back on a sale item?", expectedAnswer: "No. Sale items can be returned within 14 days for store credit only, not a refund to the payment method.", expectedSource: "Returns", tags: ["returns"] },
  { kind: "answerable", question: "What condition do returned shoes need to be in?", expectedAnswer: "Unworn, with the original box and all tags attached; shoes with signs of outdoor wear are not accepted.", expectedSource: "Returns", tags: ["returns"] },
  { kind: "answerable", question: "Is returning free from Spain?", expectedAnswer: "Yes, returns from Portugal and Spain are free.", expectedSource: "Returns", tags: ["returns"] },
  { kind: "answerable", question: "How much does a return cost from Germany?", expectedAnswer: "6 euros, deducted from the refund (other EU countries).", expectedSource: "Returns", tags: ["returns"] },
  { kind: "answerable", question: "How long does a refund take?", expectedAnswer: "Processed within 5 business days after the warehouse receives the parcel; the bank may take up to 10 more days.", expectedSource: "Returns", tags: ["returns"] },
  { kind: "answerable", question: "Do you do exchanges?", expectedAnswer: "No direct exchanges. Return the item and place a new order; the code EXCHANGE10 gives 10% off if the new order is placed within 14 days.", expectedSource: "Returns", tags: ["returns"] },
  { kind: "answerable", question: "My shoes arrived damaged, what should I do?", expectedAnswer: "Contact support@alishoes.example within 48 hours of delivery with photos; faulty items are refunded or replaced at no cost regardless of the return window.", expectedSource: "Returns", tags: ["returns"] },
  // Shipping (8)
  { kind: "answerable", question: "How long does standard delivery take to Spain?", expectedAnswer: "3 business days.", expectedSource: "Shipping", tags: ["shipping"] },
  { kind: "answerable", question: "Is shipping free?", expectedAnswer: "Standard shipping is free for orders over 60 euros; below that it costs 4.90 euros in Portugal and Spain and 7.90 euros in the rest of the EU.", expectedSource: "Shipping", tags: ["shipping"] },
  { kind: "answerable", question: "How much is express shipping to France?", expectedAnswer: "14 euros (rest of the EU), delivered in 2 business days.", expectedSource: "Shipping", tags: ["shipping"] },
  { kind: "answerable", question: "Do you ship to the UK?", expectedAnswer: "No. We ship only to European Union countries, not to the United Kingdom.", expectedSource: "Shipping", tags: ["shipping"] },
  { kind: "answerable", question: "If I order at 13:00 on a Tuesday, when does it ship?", expectedAnswer: "The same day; orders placed before 14:00 Lisbon time on weekdays ship the same day.", expectedSource: "Shipping", tags: ["shipping"] },
  { kind: "answerable", question: "Which carrier delivers in Portugal?", expectedAnswer: "CTT.", expectedSource: "Shipping", tags: ["shipping"] },
  { kind: "answerable", question: "Can I change my delivery address after ordering?", expectedAnswer: "Only within 1 hour of placing the order, from the account page; after that the order is packed and cannot be changed.", expectedSource: "Shipping", tags: ["shipping"] },
  { kind: "answerable", question: "What happens if I miss both delivery attempts?", expectedAnswer: "The parcel waits at a pickup point for 7 days, then is returned and refunded minus the shipping cost.", expectedSource: "Shipping", tags: ["shipping"] },
  // Sizing (7)
  { kind: "answerable", question: "Do loafers run big or small?", expectedAnswer: "Loafers run half a size large; order half a size down.", expectedSource: "Sizing", tags: ["sizing"] },
  { kind: "answerable", question: "What size sneaker should I get if I normally wear EU 42?", expectedAnswer: "EU 43; sneakers run small, so order one full size up.", expectedSource: "Sizing", tags: ["sizing"] },
  { kind: "answerable", question: "Which lines come in half sizes?", expectedAnswer: "Only the Oxford and Loafer lines.", expectedSource: "Sizing", tags: ["sizing"] },
  { kind: "answerable", question: "My foot measures 27 cm, what EU size is that?", expectedAnswer: "EU 42 (after adding 0.5 cm per the measuring instructions, 27.0 cm = EU 42).", expectedSource: "Sizing", tags: ["sizing"] },
  { kind: "answerable", question: "Do you have wide fit boots?", expectedAnswer: "Yes, the Boot line comes in widths D (standard) and E (wide).", expectedSource: "Sizing", tags: ["sizing"] },
  { kind: "answerable", question: "Do you sell kids' shoes?", expectedAnswer: "No, children's shoes are not sold.", expectedSource: "Sizing", tags: ["sizing"] },
  { kind: "answerable", question: "What is the largest size you stock?", expectedAnswer: "EU 46.", expectedSource: "Sizing", tags: ["sizing"] },
  // Warranty & care (7)
  { kind: "answerable", question: "How long is the warranty?", expectedAnswer: "12 months from the delivery date, against manufacturing defects.", expectedSource: "Warranty", tags: ["warranty"] },
  { kind: "answerable", question: "Is a worn-down heel covered by the warranty?", expectedAnswer: "No. Normal wear of the sole and heel is not covered.", expectedSource: "Warranty", tags: ["warranty"] },
  { kind: "answerable", question: "How do I make a warranty claim?", expectedAnswer: "Email support@alishoes.example with the order number and photos of the defect; reply within 2 business days.", expectedSource: "Warranty", tags: ["warranty"] },
  { kind: "answerable", question: "How much does resoling cost?", expectedAnswer: "45 euros for the Oxford and Boot lines, including return shipping within Portugal and Spain; not available for Sneakers.", expectedSource: "Warranty", tags: ["warranty"] },
  { kind: "answerable", question: "How should I clean suede shoes?", expectedAnswer: "Brush with a suede brush and protect with a spray; do not use water on suede.", expectedSource: "Warranty", tags: ["care"] },
  { kind: "answerable", question: "Are the shoes waterproof?", expectedAnswer: "They are water-resistant but not waterproof; avoid prolonged rain.", expectedSource: "Warranty", tags: ["care"] },
  { kind: "answerable", question: "How long does a warranty repair take?", expectedAnswer: "10 to 15 business days including shipping.", expectedSource: "Warranty", tags: ["warranty"] },
  // Unanswerable (10): not in the documents; the assistant should refuse.
  { kind: "unanswerable", question: "Where is my order 48213 right now?", tags: ["order-status"] },
  { kind: "unanswerable", question: "Is the chestnut Oxford in size 41 in stock?", tags: ["stock"] },
  { kind: "unanswerable", question: "Do you have a physical store in Madrid?", tags: ["stores"] },
  { kind: "unanswerable", question: "What is your phone number?", tags: ["contact"] },
  { kind: "unanswerable", question: "Can I pay with Klarna or in instalments?", tags: ["payment"] },
  { kind: "unanswerable", question: "Are your shoes cheaper than Zara's?", tags: ["competitor"] },
  { kind: "unanswerable", question: "What leather tannery do you use?", tags: ["materials"] },
  { kind: "unanswerable", question: "Do you offer a student discount?", tags: ["discount"] },
  { kind: "unanswerable", question: "What are your opening hours on Sundays?", tags: ["hours"] },
  { kind: "unanswerable", question: "Can you recommend a good restaurant in Lisbon?", tags: ["off-topic"] },
];
