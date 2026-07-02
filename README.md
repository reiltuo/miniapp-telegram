# Mini App de venda de conteúdo

Frontend mobile-first para Telegram com prévias em vídeo, prova social, ofertas, checkout PIX e dois downsells.

## Arquivos de mídia

Substitua os arquivos em `assets` mantendo os nomes ou altere os caminhos em `index.html`.

O arquivo `preview.mp4` está sendo reutilizado no banner e nas quatro prévias porque somente um vídeo estava disponível. Para usar vídeos diferentes, crie `preview-1.mp4`, `preview-2.mp4` e assim por diante e ajuste cada elemento `<video>`.

## Teste local

Na pasta deste projeto, execute:

```powershell
python -m http.server 8080
```

Abra `http://localhost:8080`. O Telegram exige HTTPS para o uso real como Mini App.

## Integração PIX

O frontend espera dois endpoints próprios:

* `POST /api/pix/create`
* `GET /api/pix/status?id=ID_DA_COBRANCA`

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

### Fluxo recomendado com gateway

1. Crie uma conta empresarial em um gateway que ofereça PIX, como Mercado Pago, Asaas, Pagar.me ou Efí.
2. Obtenha as credenciais de produção e mantenha-as somente no backend.
3. No endpoint `/api/pix/create`, valide no servidor qual produto e preço podem ser cobrados. Nunca confie no valor enviado pelo navegador.
4. Chame a API do gateway para criar uma cobrança PIX.
5. Converta a resposta do gateway para o formato esperado pelo frontend.
6. Configure um webhook HTTPS no gateway para receber a confirmação do pagamento.
7. Valide a assinatura do webhook, atualize a cobrança no banco e libere o acesso de forma idempotente.
8. O endpoint `/api/pix/status` consulta o banco, não apenas o navegador ou a informação enviada pelo cliente.
9. Relacione a cobrança ao usuário do Telegram após validar `Telegram.WebApp.initData` no backend.

Não exponha token do gateway, token do bot ou segredo de webhook no HTML ou JavaScript público. O botão `Já paguei` apenas consulta o status. A liberação real deve depender do webhook confirmado pelo servidor.
