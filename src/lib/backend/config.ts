export interface BackendConfig {
    sorobanRpcUrl: string;
    networkPassphrase: string;
    commitmentCoreContract: string;
    commitmentNftContract: string;
    attestationEngineContract: string;
    chainWritesEnabled: boolean;
}

export function getBackendConfig(): BackendConfig {
    return {
        sorobanRpcUrl:
            process.env.SOROBAN_RPC_URL ??
            process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
            'https://soroban-testnet.stellar.org:443',
        networkPassphrase:
            process.env.SOROBAN_NETWORK_PASSPHRASE ??
            process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
            'Test SDF Network ; September 2015',
        commitmentCoreContract:
            process.env.COMMITMENT_CORE_CONTRACT ??
            process.env.NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT ??
            '',
        commitmentNftContract:
            process.env.COMMITMENT_NFT_CONTRACT ??
            process.env.NEXT_PUBLIC_COMMITMENT_NFT_CONTRACT ??
            '',
        attestationEngineContract:
            process.env.ATTESTATION_ENGINE_CONTRACT ??
            process.env.NEXT_PUBLIC_ATTESTATION_ENGINE_CONTRACT ??
            '',
        chainWritesEnabled: process.env.COMMITLABS_ENABLE_CHAIN_WRITES === 'true',
    };
}
