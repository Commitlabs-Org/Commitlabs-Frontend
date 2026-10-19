# Deployments (Stellar Testnet)

| Contract | Contract ID | Explorer |
| --- | --- | --- |
| commitlabs-escrow | `CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4` | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4) |

- Network: Test SDF Network ; September 2015 (testnet only)
- Admin / fee recipient: `GBLR4VPSBA7AUIOVZU4LUPOBUPURWNQZRMNACFSL74GPQ3CN6TH3V4VT`
- Escrow token: native XLM Stellar Asset Contract `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Default penalties (bps): Safe 200, Balanced 500, Aggressive 1000
- Deploy tx: [4d10bb82...](https://stellar.expert/explorer/testnet/tx/4d10bb8248177746237ddf582496bee811f082ec617f025d78a03be468a38adf)
- Smoke test: `create_commitment` (id 0, 1 XLM, Balanced, 30 days) then `fund_escrow` succeeded; `get_commitment` returns status `Funded`.

See [contracts/README.md](contracts/README.md) for the function reference.
