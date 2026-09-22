# Inventario de la implementación de referencia

Construida sobre el estado del repositorio en `bdd2a5b` (rama `main`, 2026-09-19 23:06 UTC).

`A` = archivo nuevo · `M` = modificado · `D` = eliminado. Las copias completas están en
`referencia/<misma ruta que en el repositorio>`; el `sha256` es el del archivo ya corregido,
para comprobar que lo aplicado es exactamente esto (`sha256sum` en Linux,
`Get-FileHash` en PowerShell).

| | Archivo | Bytes | Líneas | sha256 |
| :-- | :--- | --: | --: | :--- |
| M | `README.md` | 5886 | 132 | `fef14666dac1f6d561d8832a1c14f6a89c6aae1d4a624a3949b456accc18864a` |
| M | `backend/.env.example` | 3487 | 81 | `5b76197e4270e25c14d1c1a8a0b8c09a2ba559e92b0417eab8846fbc11d75e2e` |
| A | `backend/drizzle/0002_dte_reparacion.sql` | 36892 | 539 | `cfcdbe6048090c46810a4c1a5ed30a02938f2bc50ec5f5bfdbd198fee55f7ce9` |
| A | `backend/drizzle/meta/0002_snapshot.json` | 142852 | 5427 | `67d218bbb41973526ea63ed03887c55462f2e13c5377df1ec75087c3e0ab673f` |
| M | `backend/drizzle/meta/_journal.json` | 480 | 27 | `ac8ee3a257dab4f96f266addc67aacca466b71cae5b09fb6752e0a59baab1afb` |
| M | `backend/src/common/exceptions/domain-rule.exception.ts` | 1346 | 47 | `443783193d410f987bc937ee4c63644524141d69d222423e09241efcc13c4019` |
| M | `backend/src/common/filters/all-exceptions.filter.ts` | 3370 | 101 | `8384c833af1d5895fc0b7376775a10c02fb4a29f6fb05299d11153732f76d0dd` |
| M | `backend/src/common/services/events.service.ts` | 5507 | 149 | `0132d1fe6c2b96be31a58b805239cdfe8f9164fdfbb418981f9c4b1d7460960c` |
| M | `backend/src/common/services/integration-log.service.ts` | 2332 | 63 | `ac5a9859e0cd496e34d15d66e6134655cf697a787406bff7c53ca657543d1ed8` |
| M | `backend/src/config/configuration.ts` | 6641 | 181 | `a220505f9fbf7f0476c92247c18eb05a6e1080231bcf5109f8d3ed6e22c2e110` |
| M | `backend/src/database/reset.ts` | 1814 | 72 | `3a507db9657a03c4b127c2219026cb3882058c7b87ea25e72ef51e1d63fa41e8` |
| M | `backend/src/database/schema/apiary.ts` | 2909 | 71 | `cb4ac1a5ed93e69674756fd94a48f9994d005c0a14a1fce45c7387a920918888` |
| M | `backend/src/database/schema/enums.ts` | 5357 | 240 | `5d0ff656eda02989273ca0550e9bc505b2849a874501df4f968e07b06b86bb8e` |
| M | `backend/src/database/schema/establishment.ts` | 3870 | 93 | `ab2e33b62703b8debd77e961fccb17487888be7950670489c8f7e6b112a0a521` |
| M | `backend/src/database/schema/movement.ts` | 12889 | 272 | `5a03265a779169b20c2c0469ade6b2d5d24250a68bf679031f9cbc71b01b1d12` |
| M | `backend/src/database/schema/producer.ts` | 4343 | 96 | `8b6c5a604e03379ffffbba866ff257ee782c51183bae2ad742dc1f0cc761e48f` |
| M | `backend/src/database/seed.ts` | 20682 | 644 | `804dc3a5a23d183ba2301c0f55875a59ecaee342631f426a72956f3df13cc0ac` |
| M | `backend/src/modules/apiary/apiary.service.ts` | 9645 | 284 | `b2a3a5e91b6496b03acf5b48e4787663cfe001bdaeb4508f0bf99323081b7b14` |
| M | `backend/src/modules/apiary/dto/apiary.dto.ts` | 4543 | 220 | `dadb6dd66f0ab08f89146afd80117ca7e3f319378061097774ad61cbc3077074` |
| M | `backend/src/modules/establishment/dto/establishment.dto.ts` | 5293 | 219 | `2b7725a2f96f1c48efac76316b3499f2a8f9f8412b0280e410ea46217904c732` |
| M | `backend/src/modules/establishment/establishment.controller.ts` | 3431 | 94 | `26a2f0fada4e7c05a5203780273638b8c71f6895d353ecc780a6ef35300aa183` |
| M | `backend/src/modules/establishment/establishment.service.ts` | 11799 | 329 | `4c78d5ebb9a6d421ecc714608345f0f5bf48e8802cc3b99490156f61c4a68bef` |
| M | `backend/src/modules/identity/auth.service.ts` | 8834 | 257 | `6d41a6b4c62289cd3eac969fce2defb6130458fcbb748d0faa31d677617ed1db` |
| A | `backend/src/modules/movement/dte-checks.service.ts` | 17252 | 478 | `8ec90dd155570b2340f2135e62970a4b115bc238273427323e57030bde17a21b` |
| A | `backend/src/modules/movement/dte-lifecycle.service.spec.ts` | 2193 | 56 | `1e41013866de782293b0bdbe7b60e05b449008e3bf6ac805014b1b248a6e7ec3` |
| M | `backend/src/modules/movement/dte-lifecycle.service.ts` | 8996 | 248 | `196b1c44e64632b4e9d3fe9f69d701b4c31729b7584eacb557893d01a41f106f` |
| A | `backend/src/modules/movement/dte-query.service.ts` | 15270 | 395 | `04bc560bdd0e69f692f424ee59c04d0513f79a04507bacf9f434e6bd494f6542` |
| M | `backend/src/modules/movement/dte-sync.worker.ts` | 13427 | 383 | `a4357354c1b00f9fc9ebe091bc3f0ddd3b32e6fde3b58545d1d8d9fe6c16cde8` |
| A | `backend/src/modules/movement/dte.access.ts` | 1808 | 49 | `12b7d637b98f2fd59ec595fec7e80a1b0fbc9c05d77f6b8d85ff1e81623413dd` |
| M | `backend/src/modules/movement/dte.controller.ts` | 6424 | 204 | `3eefe8776a7db4aef687f8ee607a7fa8aca4277bf8934812aa3ad614a99fd39b` |
| A | `backend/src/modules/movement/dte.draft.ts` | 4735 | 131 | `24432b69d2501d56a75c3b1b71835524e960a45b6d3834315775c27beafeecff` |
| M | `backend/src/modules/movement/dte.presenter.ts` | 2469 | 79 | `3b9c1f172619838b95d7c74bfb81b4ddcd6c02d950ea8c69443fb5f812053597` |
| M | `backend/src/modules/movement/dte.queries.ts` | 3382 | 97 | `f883b9eaffd60d722274f81c891849d985b8c188993f4aea24d70de513b71fb2` |
| A | `backend/src/modules/movement/dte.rules.spec.ts` | 7114 | 173 | `19c02a06dd255a0d50688c78cf174dda4808886227f9054490b688ab2c52300a` |
| M | `backend/src/modules/movement/dte.rules.ts` | 14349 | 394 | `20e320acd7a5a5ad7562d28194d4a1e9eb96a5e4f473f28e83eec03f4efd0b1d` |
| M | `backend/src/modules/movement/dte.service.ts` | 39814 | 1162 | `cb885b7f04bf4cd8ac8d2b9d6af528b536a774eff6d74754ed514bfcb03c8060` |
| A | `backend/src/modules/movement/dte.types.ts` | 1506 | 54 | `7cef749b441577a80578cb934c777dc5f4c39203fe6f4dfce2e799750d29cacf` |
| M | `backend/src/modules/movement/dto/dte.dto.ts` | 9065 | 355 | `9e5c47156578eec117b3777989e8c690f9a5c1f072dfc8b3583406072ca11b22` |
| M | `backend/src/modules/movement/dto/movement.dto.ts` | 7116 | 307 | `0b8b69adfc83367b7292bb571a1dc8822327b39d8e8a273ba6221b91ec7ee267` |
| M | `backend/src/modules/movement/movement-rule.service.ts` | 3475 | 112 | `efbf4ec2ce9698fcfc647d9f798a70d11a44892e0660fde6649531c76f2855da` |
| M | `backend/src/modules/movement/movement.controller.ts` | 6847 | 205 | `4ca7a7310a15df28ef6cfdf23eeafed8325c17431d625ad6e21f8639c4b58b4e` |
| M | `backend/src/modules/movement/movement.module.ts` | 1258 | 38 | `e5b3cc5b45c7a6962507da44103139f3fd0261d7d6dbb17371ccfb9244aaf1ca` |
| M | `backend/src/modules/movement/movement.service.ts` | 19310 | 547 | `9f14835b83b9b3d43d2d6b55fc95d77729bf09597ff7bf8f3a7ad6c0e841fb08` |
| M | `backend/src/modules/movement/senasa/manual.gateway.ts` | 1506 | 50 | `bd21bc69d2152c75e69e01278b7d881233f95c863ff07403762f06c67f6134c5` |
| M | `backend/src/modules/movement/senasa/senasa.gateway.ts` | 3853 | 118 | `fd4084c8910b1cf467e894eced43ef3248e8e739ba6b3c077170d22966db7f37` |
| M | `backend/src/modules/movement/senasa/senasa.provider.ts` | 1595 | 39 | `2f4f78d6e72563cb7ccc80882f1d45763a8c2feadecd25062915ec9b62dae5e1` |
| M | `backend/src/modules/movement/senasa/sigsa.gateway.ts` | 2863 | 80 | `ff5ba8d20f7bdf98e4256e81fb6ee819b04e682e666a00febe0b4763afbf9764` |
| A | `backend/src/modules/movement/senasa/simulated.gateway.spec.ts` | 2269 | 65 | `43ca0dd584a4970eb52ea6912bb4ddcc412844ed1d023134ad1698b93ff7fce6` |
| M | `backend/src/modules/movement/senasa/simulated.gateway.ts` | 3750 | 101 | `fae633405c07c146c7642757d5b5048b409b8745d4abce44e9539746bbc4c447` |
| M | `backend/src/modules/producer/dto/producer.dto.ts` | 4691 | 195 | `02f0ec9828269df14790b422f0bb5ce6147cc1cc8bce6518bc12e9a43c7d33bf` |
| M | `backend/src/modules/producer/producer.controller.ts` | 4134 | 124 | `edd9a0afe633af426471f82737c6d70e97e4004c29de876561281301936047c3` |
| M | `backend/src/modules/producer/producer.service.ts` | 9407 | 286 | `a80ff1aac11d9d4d6769dd626b8ec486a3ce02044a86a827652efc53255efeda` |
| M | `backend/src/modules/production/extraction.service.ts` | 9827 | 266 | `d79f88d28ee04ae441319c2f1be1d11027af4915f4e07258100bc44497dc30b1` |
| M | `backend/src/modules/traceability/traceability.service.ts` | 34624 | 1006 | `74c119e6fa67ef67c1a8aeb9b6e5705d82bb373cc0119f60cc636208864f5550` |
| A | `backend/test/dte.e2e-spec.ts` | 25699 | 737 | `88bce6b083f31be7ffbe2b8340405d37ff56fe430b62029a09273c3c46f275b4` |
| M | `backend/test/env-setup.ts` | 928 | 18 | `363d8874d1bbb420bf75cdbf7e65483e4b7cb6bf593f4fd687a61cd25fc1ab6a` |
| M | `backend/test/global-setup.ts` | 791 | 21 | `75ff3e283bc9b0c7aef338a57fde06d2cf235b93b1fb505efd4afb643f8254b5` |
| A | `backend/test/tables.ts` | 722 | 38 | `7f9ccc401d507c391612e1d81fefdd032c4dbc226cb92f6d5645b76dd4aa735c` |
| M | `backend/test/traceability.e2e-spec.ts` | 28492 | 802 | `79be3d9ad3fa803bae8df76df8943215d805162e8ddf3fa745beff4ae98038fc` |
| M | `docs/manuales/00-introduccion-y-conceptos-basicos.md` | 10354 | 139 | `0b62a79b35841f25d4d6f8c104143c7ab596dfeb5401e05cc976c4c82b1f2a49` |
| M | `docs/manuales/01-manual-productor.md` | 8614 | 151 | `80c53c195998efe94beb8b31de4bb71fb2e380f6ce887aabdd0864c9c2776f93` |
| M | `docs/manuales/02-manual-sala-extraccion.md` | 8394 | 155 | `454c612fc95220ff618418eaea47e4c149b7f375e7df956068fcf944cfa331f2` |
| M | `docs/manuales/03-manual-acopiador-fraccionador.md` | 8745 | 152 | `c86ad76a73c096c4314e685e359b46adab6a6d453eab629ba343b3a18bd9b44e` |
| M | `docs/manuales/04-manual-transportista.md` | 8163 | 121 | `04e3378771f4387b5edf6e1354d318afcbe524cf69be1725c3bce369526e26c6` |
| M | `docs/manuales/05-manual-auditor-laboratorio.md` | 9318 | 141 | `ea74387746903cef1823dd66eef7cfe50734ff70a4df767105cccf733b7c4205` |
| M | `docs/manuales/06-manual-administrador.md` | 11215 | 156 | `d9a33b60c43ce255cc0a60b6c13885056357e0f3dcc7635837af949d9d2397c3` |
| M | `docs/manuales/README.md` | 6461 | 70 | `3884eefd755270862a52ab422bab748087236219a7fc7fa3444a9213bb56bc73` |
| M | `frontend/.env.example` | 485 | 10 | `7cf8a2e6c3d0ed337cb4abe2fe0f50a0b2f974bdeb0e05c1fefe7d4b34f8bbca` |
| M | `frontend/src/App.tsx` | 8380 | 249 | `95014064c7555ed431a463519bc0fb84c3dd41db41df3211519c809d2e3db6ce` |
| M | `frontend/src/components/DteChecks.tsx` | 1121 | 32 | `05dc6b42181198601f7eaef0a34127ea9bae0f43941fc8300653ecba29822a95` |
| M | `frontend/src/components/OfficialRegistrySheet.tsx` | 4203 | 134 | `ab46697d82df76be7fc57436da106f709fcccb961b8f80f63b587c84acd80cb3` |
| D | `frontend/src/components/TransitSemaphoreBadge.tsx` | — | — | — |
| M | `frontend/src/lib/dte.test.ts` | 1500 | 47 | `3427292cdc05159bc6dcce079d0aff4e52ac0388d4451704733318bbbdd7509c` |
| M | `frontend/src/lib/dte.ts` | 3669 | 115 | `191ddf5bbe8441d0d37a25e00dd2660571941f31d09936435e6c94bf9203cfbe` |
| M | `frontend/src/lib/errors.ts` | 13327 | 404 | `cfbe53e69d037a1186307faef6260311c4e59dbd95ebe8add119f490487c1b0d` |
| M | `frontend/src/lib/nav.ts` | 5004 | 157 | `18b0cb3a2aa5b93e65d76189da226d2958867071f937323f609245ded8b2b338` |
| M | `frontend/src/lib/settingsContext.tsx` | 3411 | 100 | `a5195cd93b3cf2281734a61125032a372205284be993fdb65af036157e83ac92` |
| M | `frontend/src/lib/types.ts` | 12929 | 549 | `9df2148ed656eaa270a59f14e23e615479a8bd14d38abddd0076af57626506b6` |
| M | `frontend/src/lib/vocabulary.ts` | 33391 | 718 | `314c6996acb501ea1803f08976548211ae527af6a3dfef9a750eff3b3bb043b5` |
| M | `frontend/src/pages/ApiariesPage.tsx` | 15044 | 471 | `3c4b8b41bb5c3c8af021cfe89b7464d659f2b053c0b5f647bc0c72e0b8b1f5e9` |
| M | `frontend/src/pages/DashboardPage.tsx` | 16375 | 497 | `f9c13d3c0576f1337c46d191428374915521467c3b5e9968208a965f1a0c0689` |
| M | `frontend/src/pages/DteDetailPage.tsx` | 28133 | 858 | `b30f1fc9183b9d1324f33df3352f1ac2a5e19901ce52b16b976342575d86f03f` |
| M | `frontend/src/pages/DtePage.tsx` | 27808 | 843 | `899a72b60da7ba779476ce1e78b5e7c9ee9429c813ad3784834b60d7690a41cc` |
| M | `frontend/src/pages/EstablishmentsPage.tsx` | 13400 | 429 | `80173c85dc038a933987fb74a5e34397fe60694b9b9a51f1fbfe5c79de2a3027` |
| M | `frontend/src/pages/LoginPage.tsx` | 7512 | 196 | `321c04c50fdae39d38082c84cdc4c0025b3de66cc6221d4f6fd1b6d7e50f6f90` |
| M | `frontend/src/pages/MovementDetailPage.tsx` | 28399 | 805 | `4490ee5d09093e6c0af661c77d7d548569c8801670f1c3ef61e36d54af9689c4` |
| M | `frontend/src/pages/ProducersPage.tsx` | 17432 | 547 | `2ed44bcab4d187d529d54df892af0416d2889cacd0cfbdf10b2d007895e83045` |
| M | `frontend/src/pages/SettingsPage.tsx` | 15550 | 370 | `5d0eb0b3128f4d7c24e2db5b680aa4584c08f856cb144882fae698b0d5cd4bc8` |
| M | `frontend/src/styles.css` | 50431 | 1598 | `5ce15fd5b24d89d403ce07548551abe545240ccf1d4b9f1a8bc575f145b8a439` |
| M | `landing/index.html` | 50301 | 931 | `01a80a23bfa2f0f5c4953df96b1a013978a5c92ab8c7053faf3cdb41ed815faf` |
| M | `render.yaml` | 4692 | 127 | `adb7c355378d13eaa01bb804217482d042051ea8381e5239de9bf0f2b9b00ea8` |

Total: 91 archivos (12 nuevos, 78 modificados, 1 eliminado).
