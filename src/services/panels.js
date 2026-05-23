import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from "discord.js";
import { CONFIG } from "../config/index.js";

// ==================== PAINEL GERAL ====================
export async function sendPainelGeral(channel) {
    const embed = new EmbedBuilder()
        .setTitle("🎫 Sistema de Tickets | Portugal Alfa Community")
        .setDescription(
            "**Olá! Seja Bem-vindo ao nosso sistema de tickets oficial do Portugal Alfa Community!**\n" +
            "Aqui poderás abrir qualquer tipo de tickets e poder falar com um dos nossos administradores da comunidade!\n" +
            "**Toda a informação que for dada dentro da sala dos tickets será recolhida e analisada e será depositada em banco de dados encriptados!**\n" +
            "**📋 Regras a cumprir:**\n" +
            "`->` Não mencionar cargo de administrador ou membro;\n" +
            "`->` Não divulgar links inapropriados durante o processo;\n" +
            "`->` Entre Outros….\n\n" +
            "⚠️ **Qualquer descumprimento destas regras levará ao encerramento do ticket sem aviso prévio e dependendo das situações será usado a opção de timeout de um tempo indeterminado!**\n" +
            "✅ **Use mas não Abuse!**"
        )
        .setColor(0x262af1)
        .setImage(CONFIG.IMAGEM_GERAL);

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("ticket_geral")
            .setPlaceholder("📋 Selecione uma função")
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel("Bugs")
                    .setDescription("Clica Aqui para abrir ticket de Bugs!")
                    .setValue("bugs")
                    .setEmoji(CONFIG.EMOJI_BUGS),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Denúncia")
                    .setDescription("Clica Aqui para abrir ticket de Denúncias!")
                    .setValue("denuncia")
                    .setEmoji(CONFIG.EMOJI_DENUNCIA),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Suporte")
                    .setDescription("Clica Aqui para abrir ticket de Suporte!")
                    .setValue("suporte")
                    .setEmoji(CONFIG.EMOJI_SUPORTE),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Criador De Conteudo")
                    .setDescription("Clica Aqui para abrir ticket de Criador!")
                    .setValue("criador")
                    .setEmoji(CONFIG.EMOJI_CRIADOR),
            ),
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    return msg;
}

// ==================== PAINEL RECRUTAMENTO ====================
export async function sendPainelRecrutamento(channel) {
    const embed = new EmbedBuilder()
        .setTitle("📋 Sistema de Recrutamento | Portugal Alfa Truckers")
        .setDescription(
            "**Bem-vindo ao centro de recrutamento da Portugal Alfa Truckers!**\n" +
            "A amizade é o combustível que mantém a nossa VTC sempre em movimento.\n\n" +
            "**📋 Requisitos:**\n" +
            "`•` Máx. 100 km/h sempre – simulação real acima de tudo.\n" +
            "`•` Respeito total entre membros e jogadores.\n" +
            "`•` Comboios = disciplina + pontualidade.\n" +
            "`•` Cumprir quilometragem mínima mensal: 15.000 KM/mês (≈ 500 km/dia).\n" +
            "`•` Foco no ranking nacional respeitando os 0 aos 100 km/h.\n" +
            "`•` Trucky para gerir e monitorizar toda a atividade da empresa.\n" +
            "`•` Aqui a estrada é amizade, não competição.\n\n" +
            "**⏳ Aviso Importante:**\n" +
            "Não cumprimento dos requisitos mínimos em 60 dias pode resultar no desligamento das atividades da empresa; após esse período, o membro poderá continuar participando normalmente das demais atividades do Discord."
        )
        .setColor(0x262af1)
        .setImage(CONFIG.IMAGEM_RECRUTAMENTO);

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("ticket_recrutamento")
            .setPlaceholder("📋 Selecione uma opção")
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel("Recrutamento PAT")
                    .setDescription("Clique aqui para abrir ticket de Recrutamento!")
                    .setValue("recrutamento")
                    .setEmoji(CONFIG.EMOJI_RECRUTAMENTO),
                new StringSelectMenuOptionBuilder()
                    .setLabel("Pedir ajuda")
                    .setDescription("Clique aqui para abrir ticket de ajuda use se não entender algo do recrutamento ou no trucky")
                    .setValue("ajuda")
                    .setEmoji(CONFIG.EMOJI_AJUDA),
            ),
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    return msg;
}

// ==================== PAINEL REGRAS ====================
export async function sendPainelRegras(channel) {
    const embed = new EmbedBuilder()
        .setTitle("📜 Regras Gerais | Portugal Alfa Community")
        .setDescription(
            "### 1. Respeito e Convivência\n" +
            "1.1 Respeita todos os membros e a Equipa (Staff). Ofensas, insultos ou toxicidade não serão tolerados.\n" +
            "1.2 Diferenças de opinião são permitidas, desde que tratadas com maturidade e educação.\n" +
            '1.3 Evita comportamentos excessivos ou "trollagem" que possam incomodar os outros.\n\n' +
            "### 2. Identidade e Conteúdo\n" +
            "2.1 Nomes de utilizador e avatares ofensivos ou com conteúdo explícito são proibidos.\n" +
            "2.2 É estritamente proibido partilhar imagens, vídeos ou links inapropriados (NSFW/Gore).\n" +
            "2.3 Mantém o conteúdo de acordo com o tema de cada canal.\n\n" +
            "### 3. Divulgação e Spam\n" +
            "3.1 Divulgar outros servidores ou comunidades requer autorização prévia da Administração.\n" +
            "3.2 Publicidade de produtos ou eventos só é permitida com permissão.\n" +
            "3.3 Não envies mensagens repetitivas ou desnecessárias (Spam/Flood).\n\n" +
            "### 4. Canais de Voz e Texto\n" +
            "4.1 Respeita o propósito de cada sala. Não perturbes a experiência dos outros membros.\n" +
            "4.2 É proibido gritar ao microfone, usar modificadores de áudio irritantes ou saturar o som.\n" +
            "4.3 Canais de suporte devem ser usados apenas para questões reais e relevantes.\n\n" +
            "### 5. Privacidade e Segurança\n" +
            "5.1 Gravar conversas ou expor conteúdos de terceiros sem autorização é proibido.\n" +
            "5.2 Não partilhes informações pessoais (moradas, fotos, telemóvel) tuas ou de outros.\n\n" +
            "### 6. Tolerância Zero\n" +
            "6.1 Racismo, xenofobia, homofobia ou qualquer forma de discriminação resultam em **banimento imediato**.\n" +
            '6.2 Discursos de ódio ou "piadas" ofensivas não serão tolerados.\n\n' +
            "### 7. Conduta e Penalidades\n" +
            "7.1 Modera o uso de linguagem obscena ou palavrões.\n" +
            "7.2 As violações serão analisadas pela Staff e podem resultar em: **Aviso ➔ Mute ➔ Kick ➔ Ban**.\n" +
            "7.3 A Staff reserva-se o direito de ajustar estas regras para garantir um ambiente saudável.\n\n" +
            "**Aceitação das Regras**\n" +
            "Ao clicares no botão abaixo e permaneceres nesta comunidade, aceitas todos os termos de serviço. O incumprimento das regras resultará na sanção adequada."
        )
        .setColor(0x262af1)
        .setImage(CONFIG.IMAGEM_REGRAS);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("aceitar_regras")
            .setLabel("✅ Aceitar Regras")
            .setStyle(ButtonStyle.Success),
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    return msg;
}
