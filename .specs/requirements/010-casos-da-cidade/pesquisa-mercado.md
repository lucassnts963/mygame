# Pesquisa de mercado — casos da cidade com patrocínio local

Anexo de [`requirements.md`](requirements.md). Pesquisa feita em 2026-08-17.

> **Toda afirmação numérica aqui carrega fonte.** É o mesmo princípio que o jogo exige da lore em
> `canon: historico`: pesquisa sem fonte é, neste documento, o equivalente a um NPC inventando
> pista. O que não foi possível apurar está na seção "O que não sei", não disfarçado de estimativa.

---

## 1. Três precedentes

### 1.1 Niantic / Pokémon GO — o patrocinador paga pelo local

O modelo mais próximo da ideia original: um estabelecimento paga para virar ponto de interesse
dentro do jogo.

| Dado | Valor |
|---|---|
| Custo por visitante único diário | **até US$ 0,50** |
| Mensalidade de PokéStop para pequeno negócio | **~US$ 30/mês** (premium: o dobro) |
| Visitas geradas a locais patrocinados | **500 milhões** |
| Grandes parceiros | McDonald's Japão (3.000 lojas), Starbucks (7.800), SK Telecom (4.000) |

**O que aprender:** o preço por visita é baixo e a mensalidade de pequeno negócio cabe no bolso de
um comércio de bairro. O modelo é comprovado — **em escala**. A Niantic vendia acesso a uma base
de milhões de jogadores já existente.

**O que não copiar:** a Niantic começou com o jogo mais baixado do mundo e só depois vendeu cota.
A ordem inversa é o problema central da ideia (ver seção 3).

### 1.2 Questo — o jogador paga, o criador local recebe

Plataforma romena de jogos de exploração urbana: caminhadas autoguiadas em formato de escape room.

| Dado | Valor |
|---|---|
| Preço por quest | **€ 8–20** |
| Cidades | **1.000+** |
| Criadores com receita recorrente | **~30 mil** |
| Investimento levantado | **US$ 1,5 mi** (Early Game Ventures) |
| Distribuição | App próprio, TripAdvisor, Expedia, GetYourGuide, Klook, Musement |
| Reconhecimento | Prêmio da Organização Mundial do Turismo da ONU (2019) |

**O que aprender — e é o achado mais importante da pesquisa:** a Questo prova que **"o usuário cria
seus próprios módulos" pode ser o modelo de negócio, e não apenas um recurso**. Trinta mil criadores
locais escrevendo conteúdo e recebendo parte da receita é exatamente a arquitetura que o Vestígio
já tem construída — bundle declarativo, validador, playtest — sem que ninguém tivesse pensado nela
como fonte de receita.

Resolve também o gargalo que a seção 15 dos requisitos aponta: se cada cidade precisa de um caso
pesquisado, o limite não é técnico, é de autoria. Um modelo de criadores transfere a autoria para
quem conhece a cidade.

### 1.3 Passeio Carioca — o análogo brasileiro

Aplicativo carioca de roteiros históricos gamificados, com geolocalização, narrativa e gamificação.

| Dado | Valor |
|---|---|
| Roteiros temáticos | **60+** |
| Modelo | Patrocínio privado + apoio institucional |
| Patrocinadora citada | Sérgio Castro Imóveis (que também bancou o restauro da Igreja de N. Sra. da Lapa dos Mercadores em 2023) |
| Apoio público | Ação Local Cultural, Secretaria Municipal de Cultura |
| Aceleração | Programas de Pré e de Aceleração do IBMEC |

**O que aprender:** é o precedente mais parecido com o que você quer fazer, no mesmo país, com a
mesma mecânica. E a ordem que ele seguiu importa: **institucional e patrocinador âncora primeiro**,
não venda de cota porta a porta. A patrocinadora citada declara o benefício exatamente nos termos
da sua ideia — "incentiva pequenos negócios ao aumentar o fluxo de turistas".

---

## 2. Os três modelos, lado a lado

| | **A. Comerciante paga** | **B. Institucional paga** | **C. Jogador paga** |
|---|---|---|---|
| Referência | Niantic | Passeio Carioca | Questo |
| Quem assina o cheque | Padaria, restaurante, loja | Secretaria de Turismo/Cultura, SEBRAE, associação comercial | O próprio jogador |
| Ordem de grandeza | US$ 30/mês por ponto ou até US$ 0,50/visita (Niantic) | Projeto ou edital cultural | € 8–20 por caso (Questo) |
| Recorrência | Mensal, cancelável | Pontual, com ciclo longo | Por caso vendido |
| **Quando funciona** | Quando já existe fluxo de jogadores | **No começo, quando não existe fluxo** | Quando há catálogo e turista |
| **Ponto cego** | **Ovo e galinha** | Calendário político, burocracia | Um caso não sustenta; precisa de catálogo |
| Exige do produto | Contagem anti-fraude (`REQ-27`), relatório (`REQ-29`) | Relatório de alcance, marca do apoiador | Pagamento no app, catálogo, repartição |
| Exige de você | Vender de porta em porta | Protocolar, esperar, apresentar | Volume de conteúdo |
| Risco à integridade do caso | **Alto** — quem paga quer aparecer | Baixo | Baixo |
| Casa com "o usuário cria módulos"? | Parcialmente | Não | **Sim, diretamente** |

### O que a pesquisa deixa claro

**O modelo A — o que a ideia original assumia como primeiro passo — é o mais difícil de começar,
não o mais fácil.** O comerciante compra fluxo de pessoas; sem jogadores em Barcarena, não há fluxo
para vender, e a primeira reunião termina em "me procura quando tiver gente usando".

Os dois precedentes que começaram do zero — Passeio Carioca e Questo — **não** começaram pelo
modelo A. Um começou institucional, o outro começou vendendo ao jogador com criadores locais.

Isto não é recomendação: você pediu os três lado a lado, e aqui estão. É constatação sobre a
ordem, e ela contradiz a intuição da ideia original — que é justamente por que vale estar escrita.

---

## 3. Quatro tensões com o que já está construído

### 3.1 O relatório do patrocinador versus o `NFR-01`

O `CHG-007` gravou no banco uma decisão forte: **não existe tabela de posição, trajeto ou histórico
de localização**, e há um teste varrendo o `information_schema` para provar. A migration diz isso
em comentário: *"a forma confiável de garantir que nenhum trajeto seja guardado é não haver coluna
onde escrevê-lo"*.

A primeira pergunta de qualquer comerciante vai ser *"quantas pessoas o app trouxe pra minha
loja?"* — e responder isso pressiona exatamente essa garantia.

**Saída:** contador agregado **por pista**, nunca por jogador. `visitas_por_pista(clue_id, dia,
total)` responde ao comerciante sem que exista uma linha ligando pessoa a lugar. É o `REQ-25`.

A tensão é real e vai voltar: no dia em que alguém pedir "quantos vieram de manhã, quantos eram
mulheres, quantos voltaram", cada uma dessas respostas custa um pedaço do `NFR-01`. Vale saber de
antemão onde é a linha.

### 3.2 Pagar por visita exige visita verificável

O servidor já revalida a posição (`REQ-02`) — a fundação está certa. Mas ele confia no que o
cliente informa, e um app adulterado mente.

Hoje isso é trapaça de jogador contra si mesmo. **No dia em que a visita virar dinheiro, vira
fraude lucrativa**: quem quiser inflar a contagem de uma loja tem incentivo direto.

As defesas conhecidas: detecção de mock location e emulador, verificação de integridade do
aparelho, velocidade impossível entre coletas, cruzamento de GPS com IP e Wi-Fi, coordenadas
repetidas. Nenhuma é barata — a Niantic gastou mais de um ano de engenharia só nisso.

**Implicação prática:** não construir nada disso antes de a visita valer dinheiro. É o `REQ-27`
como `Should`, não `Must`.

### 3.3 Um estabelecimento real não pode ser o culpado

**A tensão mais séria, e não estava na ideia original.**

Casos bíblicos acusam personagens de dois mil anos atrás. Um caso histórico de Barcarena acusa
**pessoas e lugares reais**, com descendentes vivos e negócios abertos. Um comércio existente
apontado como culpado de um crime — ainda que ficcional, ainda que ambientado em 1835 — é risco de
dano à imagem.

E a combinação com patrocínio é pior: um patrocinador que descobre ser o vilão do caso não é só
problema jurídico, é o fim do contrato.

**Precisa ser regra do validador, não recomendação.** `solution.culprit` nunca pode ser um
`sponsor` (`REQ-23`), e o culpado de caso histórico precisa ser ficcional ou já documentado com
fonte (`REQ-30`). O validador de módulo já reprova segredo literal e página spoiler exposta; esta é
a mesma categoria de regra.

### 3.4 Patrocínio resolve um problema que o Pokémon GO criou

A Niantic fechou acordo de **US$ 4 milhões** em ação coletiva por jogadores invadindo propriedade
privada, e teve de remover pontos perto de residências unifamiliares e evitar novos.

Aqui o patrocínio joga a favor: **pista patrocinada é pista consentida** — o dono do lugar
autorizou por contrato.

O risco fica nas pistas **não** patrocinadas, e um caso histórico as quer justamente onde dói:
igreja antiga, casarão, prédio tombado, terreno particular. Daí o `REQ-26`: âncora em propriedade
privada exige consentimento registrado.

---

## 4. Barcarena — a matéria-prima

| Dado | Valor |
|---|---|
| População | ~126.650 (IBGE) |
| Distância de Belém | ~40 km |
| Economia | Polo industrial: caulim, alumina, alumínio, cabos de transmissão; agricultura; turismo |
| Porto | Vila do Conde — o maior do Pará |

**História utilizável, com fonte:**

- **Igreja de São João Batista**, século XVII — a construção mais antiga do município. Atravessou a
  **Cabanagem** e recebeu o **Padre Antônio Vieira**.
- **Vila do Conde**, século XVII — a localidade mais antiga do município; 371 anos comemorados.
- Origem do nome: a embarcação *Arena*, chamada de "barca" pelos moradores — "barca" + "Arena".
- Freguesia de São Francisco Xavier de Barcarena criada em **1758**.
- Povos originários do território: Mortiguras, Gibiriés e Canapijós, do tronco Tupinambá.
- Praias de água doce: Cuipiranga, Guajarino, Caripi (Trapiche do Caripi).

**Leitura:** a Cabanagem numa igreja do século XVII é um caso pronto esperando ser escrito. Não
precisa inventar nada — precisa da mesma disciplina de `canon: historico` com `source` que a lore
já exige, e de um historiador local para revisar.

**Cuidado:** a Cabanagem foi uma revolta popular violentamente reprimida, com mortos reais e
famílias reais. Escrever um "culpado" ali exige o `REQ-30` levado a sério, e provavelmente revisão
de alguém que estude o tema.

---

## 5. LGPD

Localização é dado pessoal e o uso exige:

- **Finalidade específica e informada** — dizer para que a localização é usada, em linguagem clara.
- **Base legal escolhida e registrada.** Diferente do GDPR, a LGPD admite **legítimo interesse**
  para ação publicitária, não só consentimento — mas com salvaguardas.
- **Ônus da prova é do controlador**: consentimento obtido de forma enganosa, abusiva ou pouco
  transparente é **nulo** (arts. 8º e 9º).
- **Direitos do titular**: acesso, correção e eliminação.

**O que isso significa aqui, concretamente:** o `NFR-01` — não guardar trajeto — deixa de ser só
higiene e vira **vantagem regulatória**. Não se pede consentimento para tratar o que não se
armazena, e não há o que eliminar a pedido do titular. Quanto menos o banco souber, menor a
superfície de conformidade.

Isso muda o cálculo da seção 3.1: cada relatório mais detalhado ao patrocinador não custa só
privacidade — custa também obrigação de conformidade.

---

## 6. O que não sei

Honestidade sobre os limites desta pesquisa. Nada abaixo foi apurado, e **nenhum destes números
deve ser estimado sem conversa**:

- Quanto um comércio de Barcarena gasta em publicidade por mês, e em quê.
- Se a Secretaria de Turismo ou de Cultura de Barcarena tem linha, edital ou interesse.
- Se existe associação comercial ativa no município e qual o alcance dela.
- Quantos moradores de Barcarena topariam caminhar por um mistério — não há proxy confiável.
- Quanto do fluxo de Belém para as praias de Barcarena é turista com disposição a jogar.
- Se há arquivo histórico municipal acessível, ou historiador local disponível para revisar.
- Se bem tombado exige anuência do IPHAN para virar ponto de visitação num app.

As três primeiras decidem se o modelo A ou B é viável. A quarta decide se **qualquer** modelo é.

---

## 7. Fontes

**Niantic / Pokémon GO**
- [Niantic charges up to $0.50 for every visitor — PocketGamer.biz](https://www.pocketgamer.biz/niantic-pokemon-go-partnership/)
- [Sponsored Locations Are Coming to Pokémon Go on a Cost-Per-Visit Basis — Ad Age](https://adage.com/article/digital/pokemon-s-ad-model-a-cost-visit-basis/304952/)
- [Sponsored Locations for Business — Niantic](https://nianticlabs.com/sponsoredlocations)
- [How Does Pokémon Go Make Money — productmint](https://productmint.com/how-does-pokemon-go-make-money/)

**Questo**
- [Questo raises $1.5 million — Tech.eu](https://tech.eu/2021/02/18/questo-funding/)
- [Questo — site oficial](https://questoapp.com/)
- [Questo raises $1.5M to bring city exploration games to 200+ cities](https://questoapp.com/blog/questo-new-investment-to-create-exploration-games-in-200-cities)

**Passeio Carioca**
- [App Passeio Carioca conquista moradores e turistas — Diário do Rio](https://diariodorio.com/oferecendo-inovacao-e-cultura-app-passeio-carioca-conquista-moradores-e-turistas-da-cidade/)
- [Rio ganha aplicativo visando estimular turismo — Diário do Rio](https://diariodorio.com/passeio-carioca-rio-ganha-aplicativo-com-objetivo-de-fomentar-turismo-na-cidade/)

**Propriedade privada e ações judiciais**
- [Niantic agrees to change Pokémon Go locations in trespassing settlement — AppleInsider](https://appleinsider.com/articles/19/02/15/niantic-agrees-to-change-pokemon-go-locations-in-trespassing-lawsuit-settlement)
- [Pokémon Go's Virtual Trespass Suit Reaches Settlement — NYU JIPEL](https://jipel.law.nyu.edu/pokemon-gos-virtual-trespass-suit-reaches-settlement-agreement/)

**LGPD**
- [LGPD e Geolocalização — INDAP](https://indapbr.com.br/informacoes/lgpd-e-geolocalizacao/)
- [Dados pessoais para publicidade direcionada — Machado Meyer](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/propriedade-intelectual-ij/tratamento-de-dados-pessoais-para-fins-de-analise-comportamental-e-oferta-de-publicidade-direcionada)
- [Dados de localização, privacidade e consentimento — Incognia](https://www.incognia.com/pt/blog/thoughts-about-data-privacy-and-location-consent)

**Falsificação de localização**
- [Detecting location spoofing — Incognia](https://www.incognia.com/solutions/detecting-location-spoofing)
- [Securing location trust to prevent geo-spoofing — Guardsquare](https://www.guardsquare.com/blog/securing-location-trust-to-prevent-geo-spoofing)

**Barcarena**
- [Barcarena (Pará) — Wikipédia](https://pt.wikipedia.org/wiki/Barcarena_(Par%C3%A1))
- [História e belezas naturais: 371 anos de Vila do Conde — Portal Barcarena](https://portalbarcarena.com.br/historia-e-belezas-naturais-um-olhar-para-os-371-anos-de-vila-do-conde/)
- [Investimentos do Estado e crescimento turístico de Barcarena — Agência Pará](https://www.agenciapara.com.br/noticia/63570/investimentos-do-estado-contribuem-para-crescimento-economico-e-turistico-de-barcarena)
