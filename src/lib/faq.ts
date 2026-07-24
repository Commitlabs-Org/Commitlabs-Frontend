export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}

export const faqEntries: FaqEntry[] = [
  {
    id: 'commitments',
    question: 'How do commitments work?',
    answer:
      'Commitments let you create a simple, transparent agreement tied to an asset or milestone. You can review the terms, fund the commitment, and track its status from the dashboard.',
    tags: ['commitments', 'create', 'agreement'],
  },
  {
    id: 'fees',
    question: 'What fees are charged?',
    answer:
      'Fees vary by network and action. The app surfaces the expected cost before you confirm a transaction so you can review it before signing.',
    tags: ['fees', 'costs', 'network'],
  },
  {
    id: 'disputes',
    question: 'How do disputes work?',
    answer:
      'If a commitment is disputed, the involved parties can review the evidence and follow the dispute flow in the app. The status updates as the case progresses.',
    tags: ['disputes', 'resolution', 'support'],
  },
  {
    id: 'wallet',
    question: 'Why do I need to connect a wallet?',
    answer:
      'Wallet connection is required to sign transactions, hold assets, and confirm actions on-chain. You can disconnect or switch accounts at any time from your wallet menu.',
    tags: ['wallet', 'connect', 'sign'],
  },
  {
    id: 'funding',
    question: 'How do I fund or settle a commitment?',
    answer:
      'Open the commitment details page and choose the funding or settlement action. The app will guide you through the required wallet confirmation steps.',
    tags: ['fund', 'settle', 'payment'],
  },
  {
    id: 'support',
    question: 'Where can I get more help?',
    answer:
      'Use the Discord community for real-time help with unanswered questions, product feedback, and troubleshooting. The link below is always available from the help drawer.',
    tags: ['discord', 'support', 'community'],
  },
];

export function searchFaqEntries(query: string): FaqEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return faqEntries;
  }

  return faqEntries.filter((entry) => {
    const haystack = `${entry.question} ${entry.answer} ${entry.tags.join(' ')}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
