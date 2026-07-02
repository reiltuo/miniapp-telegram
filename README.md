# Mini App de venda de conteúdo

Frontend mobile-first para Telegram com prévias em vídeo, prova social, ofertas, checkout PIX e dois downsells.

Também existe uma experiência de conversa automatizada em `/chat/`, inspirada em aplicativos de mensagens e identificada como atendimento automático. Ela oferece somente chamada de vídeo para maiores de 18 anos e utiliza o mesmo checkout PIX.

## Arquivos de mídia

Substitua os arquivos em `assets` mantendo os nomes ou altere os caminhos em `index.html`.

Os arquivos usados pela página são:

* `banner.mp4` no banner do perfil;
* `catalogo-1.mp4`, `catalogo-2.mp4` e `catalogo-3.mp4` nas prévias em vídeo;
* `catalogo-foto.jpg` na prévia estática;
* `profile.jpeg` exclusivamente na foto de perfil.

## Teste local

Na pasta deste projeto, execute:

```powershell
python -m http.server 8080
```

Abra `http://localhost:8080`. O Telegram exige HTTPS para o uso real como Mini App.

## Integração PIX com NexusPag

O projeto inclui três Vercel Functions:

* `POST /api/pix/create`
* `GET /api/pix/status?id=ID_DA_COBRANCA`
* `POST /api/webhooks/nexuspag`

O primeiro recebe:

```json
{"amount":1699,"description":"PACK VIP"}
```

E deve responder:

```json
{"id":"charge_123","copyPasteCode":"000201...","qrCodeBase64":"iVBORw0..."}
```

O segundo deve responder:

```json
{"status":"pending"}
```

ou:

```json
{"status":"paid"}
```

### Variáveis de ambiente na Vercel

Cadastre somente no ambiente `Production`:

```text
NEXUSPAG_API_KEY
NEXUSPAG_WEBHOOK_SECRET
```

A chave da API é enviada à NexusPag no header `x-api-key`. O segredo do webhook valida a assinatura HMAC antes de aceitar uma confirmação.

### Fluxo da integração

1. O frontend envia o identificador do plano em centavos.
2. O backend aceita somente os quatro preços cadastrados no código.
3. O backend converte centavos para reais e cria a cobrança na NexusPag.
4. A NexusPag retorna o código PIX, QR Code e identificador da transação.
5. O frontend consulta o status a cada cinco segundos.
6. A NexusPag também chama o webhook quando confirma o pagamento.
7. O webhook valida a assinatura HMAC antes de aceitar o evento.

O webhook atual valida e registra a confirmação nos logs da Vercel. Para controlar conteúdo realmente protegido, adicione um banco de dados e associe `external_id`, usuário do Telegram e permissão de acesso. O conteúdo protegido nunca deve depender apenas de JavaScript no navegador.

Não exponha token do gateway, token do bot ou segredo de webhook no HTML ou JavaScript público. O botão `Já paguei` apenas consulta o status. A liberação real deve depender do webhook confirmado pelo servidor.
