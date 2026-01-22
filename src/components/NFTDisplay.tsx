// Placeholder component for displaying Commitment NFTs
// This will show NFT metadata, images, and details

interface NFTDisplayProps {
  tokenId: string
  metadata?: Record<string, unknown>
}

export default function NFTDisplay({ tokenId, metadata }: NFTDisplayProps) {
  return (
    <div>
      {/* TODO: Implement NFT display with:
        - NFT image/visualization
        - Metadata display
        - Commitment parameters
        - Health metrics
        - Attestation history link
      */}
      <p>NFT Display component - Token ID: {tokenId}</p>
      {metadata && <pre>{JSON.stringify(metadata, null, 2)}</pre>}
    </div>
  )
}

