// Define the Listing type (often defined in matching component or here)
export interface Listing {
    id: string
    type: 'Safe' | 'Balanced' | 'Aggressive'
    score: number
    amount: string
    duration: string
    yield: string
    maxLoss: string
    owner: string
    price: string
    forSale: boolean
}

const mockListings: Listing[] = [
    {
        id: '001',
        type: 'Safe',
        score: 95,
        amount: '$50,000',
        duration: '25 days',
        yield: '5.2%',
        maxLoss: '2%',
        owner: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        price: '$52,000',
        forSale: true,
    },
    {
        id: '002',
        type: 'Balanced',
        score: 88,
        amount: '$100,000',
        duration: '45 days',
        yield: '12.5%',
        maxLoss: '8%',
        owner: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        price: '$105,000',
        forSale: true,
    },
    {
        id: '003',
        type: 'Aggressive',
        score: 76,
        amount: '$250,000',
        duration: '80 days',
        yield: '18.7%',
        maxLoss: '100%',
        owner: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
        price: '$—',
        forSale: false,
    },
    {
        id: '004',
        type: 'Safe',
        score: 92,
        amount: '$75,000',
        duration: '15 days',
        yield: '4.8%',
        maxLoss: '2%',
        owner: '0x8Db0A5a6C1b1e7c0E1f9c6bB1F2c4d9A1cB1974E',
        price: '$76,500',
        forSale: true,
    }
];

export async function listMarketplace(): Promise<Listing[]> {
    return mockListings;
}

export async function buyCommitment(id: string, buyerAddress: string): Promise<boolean> {
    const listing = mockListings.find(l => l.id === id);
    if (listing && listing.forSale) {
        listing.owner = buyerAddress;
        listing.forSale = false;
        return true;
    }
    return false;
}
