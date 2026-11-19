/**
 * Textos das páginas legais públicas (Política de Privacidade e Termos de
 * Serviço). São dados puros, sem JSX, para ficar fácil revisar ou atualizar.
 *
 * As rotas vivem em `src/App.tsx` (`/privacidade` e `/termos`) e os botões de
 * acesso ficam no sheet "Sobre o app" (`ModalInfo.tsx`).
 */

/** Canal de contato usado nos dois documentos. */
export const EMAIL_CONTATO = 'sswebtechcontato@gmail.com'

/** Data exibida no topo dos documentos. Atualize a cada revisão. */
export const ATUALIZADO_EM = '19 de novembro de 2026'

export type TipoLegal = 'privacidade' | 'termos'

export interface SecaoLegal {
  titulo: string
  paragrafos?: string[]
  itens?: string[]
}

export interface DocumentoLegal {
  tipo: TipoLegal
  rota: string
  rotulo: string
  titulo: string
  introducao: string
  secoes: SecaoLegal[]
}

const PRIVACIDADE: DocumentoLegal = {
  tipo: 'privacidade',
  rota: '/privacidade',
  rotulo: 'Política de Privacidade',
  titulo: 'Política de Privacidade',
  introducao:
    'Esta página explica, de forma simples, o que o Designa guarda sobre você, por que guarda e o que você pode pedir a qualquer momento. Ela vale para quem tem conta, para quem entra por convite e para quem só abre um link público de escala.',
  secoes: [
    {
      titulo: 'Quem é responsável pelos dados',
      paragrafos: [
        `O Designa é um aplicativo de organização de designações de congregação. Para qualquer pergunta, pedido de correção ou pedido de exclusão, escreva para ${EMAIL_CONTATO}. Respondemos em dias úteis.`,
      ],
    },
    {
      titulo: 'O que coletamos',
      itens: [
        'Dados da conta: nome completo, e-mail e a senha que você escolheu. A senha fica guardada em forma de código ilegível, ninguém do app consegue lê-la.',
        'Dados da congregação: nome, número, departamento de cada pessoa e o setor em que cada usuário atua.',
        'Fichas de voluntários: nome, telefone, disponibilidade, aptidões e observações que o administrador preenche para montar a escala.',
        'Escalas e registros: os dias montados, as designações feitas e os ajustes manuais, para que o histórico não se perca.',
        'Preferências do aparelho: tema claro ou escuro, avisos que você ativou e a chave técnica que o navegador usa para entregar esses avisos.',
        'Registros técnicos: data e hora de acesso e endereço IP nos logs da infraestrutura, usados só para segurança e para resolver problemas.',
      ],
    },
    {
      titulo: 'Como usamos esses dados',
      paragrafos: [
        'Usamos tudo isso por um motivo só: fazer a escala funcionar. Ou seja, montar e mostrar a escala, gerar o PDF e o link de compartilhamento, enviar os avisos que você ativou, proteger sua conta contra acesso indevido e responder quando você nos escreve.',
        'Não vendemos seus dados, não usamos para anúncio e não montamos perfil de ninguém.',
      ],
    },
    {
      titulo: 'Entrar com Google',
      paragrafos: [
        'Se a opção Entrar com Google estiver disponível, você pode criar a sessão com a sua conta do Google, sem digitar senha. Nesse momento o Google nos informa o seu nome, o seu e-mail e a sua foto de perfil, se você tiver uma.',
        'Usamos esses dados só para identificar você dentro do app. O Google não recebe a sua escala nem os dados dos voluntários. Você pode revogar essa autorização em myaccount.google.com/permissions ou passar a entrar com e-mail e senha.',
      ],
    },
    {
      titulo: 'Notificações push',
      paragrafos: [
        'As notificações são opcionais e só começam a ser enviadas quando você ativa no navegador ou no celular. A qualquer momento dá para desativar nas configurações do próprio navegador. A chave de aviso fica no seu aparelho e não serve para rastrear você em outros sites.',
      ],
    },
    {
      titulo: 'Links públicos de escala',
      paragrafos: [
        'Quando o administrador compartilha um link público, qualquer pessoa com esse link vê a escala publicada, sem precisar de conta. O link não abre a lista de membros nem as configurações da congregação.',
        'O link é como uma chave, quem o recebe enxerga a escala. Por isso vale tratar como informação da congregação e enviar só para quem precisa ver.',
      ],
    },
    {
      titulo: 'Com quem compartilhamos',
      itens: [
        'Cloudflare: hospedagem do site, banco de dados e entrega das notificações. É a infraestrutura que mantém o app no ar.',
        'Google: apenas se você usar o login com Google, com os dados descritos acima. Ainda, quando o aviso é entregue pelo navegador Chrome, ele passa pelos servidores do Google, que recebem o texto do aviso e a chave do aparelho.',
        'Nada além disso. Não vendemos, não alugamos e não trocamos dados com terceiros para fins de marketing.',
      ],
    },
    {
      titulo: 'Onde ficam e por quanto tempo',
      paragrafos: [
        'Os dados ficam em servidores da Cloudflare, com conexão criptografada (HTTPS) e acesso por conta. Guardamos as informações enquanto a conta existir. Quando você pedir a exclusão, removemos o cadastro e os registros ligados a ele das tabelas ativas.',
      ],
    },
    {
      titulo: 'Os seus direitos',
      paragrafos: [
        'Você pode pedir para ver, corrigir, exportar ou apagar os seus dados, e também saber com quem eles são compartilhados. O pedido é feito por e-mail para ' +
          EMAIL_CONTATO +
          ', e respondemos por lá.',
        'A Lei Geral de Proteção de Dados (LGPD) garante esses direitos. Se você achar que algo não está certo, pode procurar também a Autoridade Nacional de Proteção de Dados (ANPD).',
      ],
    },
    {
      titulo: 'Crianças',
      paragrafos: [
        'O app é feito para a organização de adultos na congregação e não coleta dados de crianças de propósito. Se você achar que recebemos o dado de uma pessoa menor de 13 anos, escreva para nós apagarmos.',
      ],
    },
    {
      titulo: 'Cookies e armazenamento local',
      paragrafos: [
        'Não usamos cookie de anúncio nem ferramenta de rastreamento. O app guarda no seu navegador só o que é preciso para funcionar: sua sessão, o tema escolhido e quais avisos você já viu.',
      ],
    },
    {
      titulo: 'Segurança',
      paragrafos: [
        'A conexão usa HTTPS, a senha é guardada em código ilegível e cada pessoa entra com a própria conta, vendo só o que é do seu setor. Nenhum sistema é 100% seguro, por isso avisamos assim que descobrimos qualquer problema.',
      ],
    },
    {
      titulo: 'Mudanças nesta política',
      paragrafos: [
        'Quando esta política muda, atualizamos a data no topo da página. Se a mudança for importante, avisamos dentro do app.',
      ],
    },
    {
      titulo: 'Contato',
      paragrafos: [`Dúvidas, pedidos ou reclamações: ${EMAIL_CONTATO}.`],
    },
  ],
}

const TERMOS: DocumentoLegal = {
  tipo: 'termos',
  rota: '/termos',
  rotulo: 'Termos de Serviço',
  titulo: 'Termos de Serviço',
  introducao:
    'Estes termos valem para quem usa o Designa.',
  secoes: [
    {
      titulo: 'Aceite dos termos',
      paragrafos: [
        'Ao criar uma conta ou continuar usando o app, você concorda com estes termos. Se não concordar, não use o serviço e peça a exclusão da sua conta.',
      ],
    },
    {
      titulo: 'O que é o Designa',
      paragrafos: [
        'O Designa organiza a escala de designações de uma congregação. Ele cadastra voluntários, monta a escala por setor, gera o PDF e o link de compartilhamento e, se ativado, envia lembretes.',
        'É uma ferramenta de apoio. A decisão final de quem atende em cada dia é sempre da equipe.',
      ],
    },
    {
      titulo: 'Conta e segurança',
      itens: [
        'Só administradores e pessoas convidadas criam conta. O e-mail é o seu identificador e não pode ser repetido.',
        'Você é responsável pela sua senha. Se desconfiar de alguém usando a sua conta, troque a senha e fale conosco.',
        'Mantenha os dados da conta verdadeiros, porque é com eles que a escala é montada.',
      ],
    },
    {
      titulo: 'Uso aceitável',
      itens: [
        'Não tente invadir contas alheias, explorar falhas ou acessar dados de outras congregações.',
        'Não use o app para spam, propaganda ou qualquer coisa que viole a lei ou os direitos das pessoas.',
        'Não copie em massa os dados de voluntários para uso fora da congregação.',
      ],
    },
    {
      titulo: 'Conteúdo da congregação',
      paragrafos: [
        'Os nomes, telefones, horários e escalas são da congregação que os cadastrou. Quem administra garante que tem direito de usar essas informações e que elas estão corretas. O Designa apenas organiza o que foi colocado.',
      ],
    },
    {
      titulo: 'Links públicos',
      paragrafos: [
        'O link público mostra a escala para qualquer pessoa que o receba, sem login. Quem compartilha responde por esse link. Vale conferir antes de mandar no grupo e usar só com quem precisa ver.',
      ],
    },
    {
      titulo: 'Notificações',
      paragrafos: [
        'Os avisos são opcionais e dependem de você ativar no navegador. Podemos mudar a frequência ou desativar avisos de manutenção.',
      ],
    },
    {
      titulo: 'Propriedade intelectual',
      paragrafos: [
        'O app, o design, o nome Designa e o código pertencem ao SS Web Tech. Você mantém os direitos sobre o conteúdo que coloca. Damos a você uma permissão simples e limitada para usar o app na sua congregação.',
      ],
    },
    {
      titulo: 'Serviço e mudanças de função',
      paragrafos: [
        'A gente trabalha para o app ficar no ar e para melhorar sempre. Ainda assim, pode haver manutenção ou indisponibilidade temporária. Novas funções podem ser adicionadas e outras encerradas.',
      ],
    },
    {
      titulo: 'Responsabilidade',
      paragrafos: [
        'O Designa apoia a organização e não substitui a conferência da equipe. Na medida permitida pela lei, não nos responsabilizamos por prejuízos indiretos do uso, como perda de dado por erro do próprio usuário ou por problema fora do nosso controle.',
      ],
    },
    {
      titulo: 'Encerramento',
      paragrafos: [
        'Você pode parar de usar e pedir a exclusão da conta quando quiser. Podemos suspender ou encerrar contas que violem estes termos ou que coloquem outras pessoas em risco, avisando sempre que der.',
      ],
    },
    {
      titulo: 'Mudanças nos termos',
      paragrafos: [
        'Atualizamos a data no topo desta página quando há mudança. Continuar usando depois da mudança significa que você aceitou a versão nova.',
      ],
    },
    {
      titulo: 'Lei aplicável',
      paragrafos: [
        'Estes termos seguem as leis do Brasil. Qualquer discussão será tratada no foro da comarca onde fica a sede de quem mantém o app.',
      ],
    },
    {
      titulo: 'Contato',
      paragrafos: [`Dúvidas sobre os termos: ${EMAIL_CONTATO}.`],
    },
  ],
}

export const DOCUMENTOS: Record<TipoLegal, DocumentoLegal> = {
  privacidade: PRIVACIDADE,
  termos: TERMOS,
}
