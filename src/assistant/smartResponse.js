import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { ASSISTANT_CONFIG } from "../config/index.js";
import { encontrarRespostaFAQ } from "../database/faq.js";
import { assistantMemory } from "../services/ajuda.js";
import { MessageAnalyzer } from "./analyzer.js";

export async function handleSmartResponse(message, client) {
    if (message.author.bot) return;
    if (!ASSISTANT_CONFIG.ALLOWED_CHANNELS.includes(message.channel.id)) return;
    if (assistantMemory.isOnCooldown(message.author.id)) return;

    const contentLower = message.content.toLowerCase();
    const hasKeywords = ASSISTANT_CONFIG.TRIGGER_KEYWORDS.some(kw =>
        contentLower.includes(kw)
    );
    const mentionsDiego = message.mentions.users.has(ASSISTANT_CONFIG.EXPERT_USER_ID);

    if (!hasKeywords && !mentionsDiego) return;

    assistantMemory.setCooldown(message.author.id);

    const question = message.content.replace(/<@!?\d+>/g, "").trim();

    // 1. Tentar FAQ primeiro
    const faqResposta = encontrarRespostaFAQ(question);
    if (faqResposta.found) {
        const embed = new EmbedBuilder()
            .setTitle(faqResposta.titulo)
            .setDescription(faqResposta.texto)
            .setColor(0x00ff00)
            .setFooter({ text: "🤖 Resposta automática — Info pode não estar 100% atualizada" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`smart_helpful_${message.id}`)
                .setLabel("✅ Resolveu!")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`smart_not_helpful_${message.id}`)
                .setLabel("❌ Não é isto")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`smart_search_${message.id}`)
                .setLabel("🔍 Pesquisar na net")
                .setStyle(ButtonStyle.Primary)
        );

        const sent = await message.reply({
            embeds: [embed],
            components: [row]
        });

        assistantMemory.pendingSearches.set(message.id, {
            question: question,
            messageId: sent.id,
            channelId: message.channel.id
        });
        return;
    }

    // 2. Tentar histórico do Diego
    const analyzer = new MessageAnalyzer(client);
    const similar = analyzer.findSimilarResponses(question);

    if (similar.length > 0) {
        const best = similar[0];
        let texto = `💡 **Baseado no que o <@${ASSISTANT_CONFIG.EXPERT_USER_ID}> já respondeu:**

`;
        texto += `> ${best.content}

`;

        if (best.hasLinks.length > 0) {
            texto += `🔗 **Links mencionados:**
`;
            best.hasLinks.forEach(link => {
                texto += `• ${link}
`;
            });
            texto += `
`;
        }

        texto += `⚠️ *Esta resposta foi baseada no histórico de mensagens. Pode não estar 100% atualizada.*`;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`smart_helpful_${message.id}`)
                .setLabel("✅ Resolveu!")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`smart_not_helpful_${message.id}`)
                .setLabel("❌ Não é isto")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`smart_search_${message.id}`)
                .setLabel("🔍 Pesquisar na net")
                .setStyle(ButtonStyle.Primary)
        );

        const sent = await message.reply({ content: texto, components: [row] });

        assistantMemory.pendingSearches.set(message.id, {
            question: question,
            messageId: sent.id,
            channelId: message.channel.id
        });
        return;
    }

    // 3. Se não encontrou nada, sugere pesquisa
    const encodedQ = Buffer.from(question).toString("base64").substring(0, 50);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`smart_do_search_${encodedQ}`)
            .setLabel("🔍 Pesquisar na internet")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`smart_cancel`)
            .setLabel("✖️ Cancelar")
            .setStyle(ButtonStyle.Secondary)
    );

    const sent = await message.reply({
        content: `🤔 **Não encontrei nenhuma resposta no histórico nem no FAQ.**

Queres que eu **pesquise na internet** por: "${question}"?`,
        components: [row]
    });

    assistantMemory.pendingSearches.set(message.id, {
        question: question,
        messageId: sent.id,
        channelId: message.channel.id
    });
}
