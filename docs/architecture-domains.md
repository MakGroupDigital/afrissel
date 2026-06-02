# AfriSell Domain Architecture

AfriSell is now prepared around explicit domains. The React app can still use Firebase during the MVP, but each boundary maps to a future microservice.

| Domain | Future service | API prefix | Responsibility |
| --- | --- | --- | --- |
| Identity | `identity-service` | `/api/identity` | Auth, profile, roles, business accounts, KYC |
| Commerce | `commerce-service` | `/api/commerce` | ABC, Market, orders, Stand, Vitrine, Prix Village |
| Payment | `payment-service` | `/api/payment` | AfriSpay, wallet, escrow, transactions |
| Chat | `chat-service` | `/api/chat` | AfriChat, direct chat, Village/Kyaghanda groups |
| Logistics | `logistics-service` | `/api/logistics` | Safari, delivery, transport, real estate |
| Media | `media-service` | `/api/media` | Cloudinary, media upload, video optimization |
| AI | `ai-service` | `/api/ai` | AfriAI, voice, translation, search |
| Impact | `impact-service` | `/api/impact` | FPP, impact projects, contribution ledger |

Frontend rules:

- Screens should depend on `src/domains/*` for cross-module business operations.
- `src/lib/*` can keep infrastructure adapters and compatibility facades.
- New backend calls should go through `src/domains/shared/apiClient.ts`.
- Service URLs can be split with `VITE_AFRISELL_*_API_URL`; otherwise they fall back to `VITE_AFRISELL_API_BASE_URL`.
- Firebase paths are MVP adapters. They should be replaced domain by domain behind the same contracts.
