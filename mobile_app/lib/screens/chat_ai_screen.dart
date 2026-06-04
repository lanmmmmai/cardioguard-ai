import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../providers/chat_provider.dart';
import '../providers/auth_provider.dart';
import '../ui/cg_tokens.dart';
import '../widgets/cg_widgets.dart';

class ChatAiScreen extends StatefulWidget {
  final bool isDarkTheme;

  const ChatAiScreen({
    super.key,
    required this.isDarkTheme,
  });

  @override
  State<ChatAiScreen> createState() => _ChatAiScreenState();
}

class _ChatAiScreenState extends State<ChatAiScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  ChatProvider? _chatProvider;
  int _lastAiMessageCount = 0;
  String? _lastSessionId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final chatProvider = Provider.of<ChatProvider>(context, listen: false);
      _chatProvider = chatProvider;
      _chatProvider?.addListener(_handleChatProviderChange);
      final role = authProvider.currentUser?.role ?? 'patient';
      chatProvider.fetchAiSessions(role);
    });
  }

  @override
  void dispose() {
    _chatProvider?.removeListener(_handleChatProviderChange);
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _handleChatProviderChange() {
    final chatProvider = _chatProvider;
    if (chatProvider == null) return;
    final messageCount = chatProvider.aiMessages.length;
    final sessionId = chatProvider.currentAiSessionId;
    if (messageCount != _lastAiMessageCount || sessionId != _lastSessionId) {
      _lastAiMessageCount = messageCount;
      _lastSessionId = sessionId;
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    }
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent + 100,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  String _formatTime(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return '';
    try {
      final dateTime = DateTime.parse(dateStr).toLocal();
      final hour = dateTime.hour.toString().padLeft(2, '0');
      final minute = dateTime.minute.toString().padLeft(2, '0');
      final day = dateTime.day.toString().padLeft(2, '0');
      final month = dateTime.month.toString().padLeft(2, '0');
      return '$hour:$minute - $day/$month';
    } catch (_) {
      return '';
    }
  }

  Future<void> _handleSendMessage(ChatProvider chatProvider, String role) async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    _messageController.clear();
    FocusScope.of(context).unfocus();

    // Scroll to bottom immediately for optimistic message
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());

    final success = await chatProvider.sendAiMessage(
      messageText: text,
      role: role,
    );

    if (success) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể gửi tin nhắn. Vui lòng thử lại.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final chatProvider = Provider.of<ChatProvider>(context);
    final isDark = widget.isDarkTheme;
    final role = authProvider.currentUser?.role ?? 'patient';

    final textTheme = Theme.of(context).textTheme;
    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;
    final textColor = isDark ? Colors.white : Colors.black;
    final subtitleColor = isDark ? Colors.white70 : Colors.black54;

    if (chatProvider.currentAiSessionId != null) {
      // Chat detail view
      return Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(LucideIcons.chevronLeft),
            onPressed: () {
              chatProvider.clearAiMessages();
              chatProvider.fetchAiSessions(role);
            },
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: CgColors.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(LucideIcons.bot, color: CgColors.primary, size: 20),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Trợ lý Sức khỏe AI',
                    style: textTheme.titleMedium?.copyWith(fontSize: 15, color: textColor),
                  ),
                  Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: CgColors.normal,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Hoạt động trực tuyến',
                        style: textTheme.bodySmall?.copyWith(fontSize: 11, color: CgColors.normal),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          elevation: 0,
          backgroundColor: isDark ? const Color(0xFF07080A) : const Color(0xFFF4F6FA),
        ),
        body: Column(
          children: [
            Expanded(
              child: chatProvider.aiMessages.isEmpty && chatProvider.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : chatProvider.aiMessages.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(LucideIcons.bot, size: 48, color: subtitleColor),
                              const SizedBox(height: 12),
                              Text(
                                'Bắt đầu đặt câu hỏi cho Trợ lý AI',
                                style: textTheme.bodyMedium?.copyWith(color: subtitleColor),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: chatProvider.aiMessages.length + (chatProvider.isLoading ? 1 : 0),
                          itemBuilder: (context, index) {
                            if (index == chatProvider.aiMessages.length) {
                              // Typing Indicator Bubble
                              return Align(
                                alignment: Alignment.centerLeft,
                                child: Container(
                                  margin: const EdgeInsets.symmetric(vertical: 4),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: isDark ? const Color(0xFF1E2530) : Colors.white,
                                    borderRadius: const BorderRadius.only(
                                      topRight: Radius.circular(CgRadius.md),
                                      bottomLeft: Radius.circular(CgRadius.md),
                                      bottomRight: Radius.circular(CgRadius.md),
                                    ),
                                    border: Border.all(
                                      color: isDark
                                          ? Colors.white.withValues(alpha: 0.05)
                                          : Colors.black.withValues(alpha: 0.05),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const SizedBox(
                                        width: 12,
                                        height: 12,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 1.5,
                                          valueColor: AlwaysStoppedAnimation<Color>(CgColors.primary),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        'AI đang phân tích câu hỏi...',
                                        style: textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }

                            final msg = chatProvider.aiMessages[index];
                            final isUser = msg.sender == 'user';
                            final text = msg.message;
                            final time = _formatTime(msg.createdAt.toIso8601String());

                            return Align(
                              alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                              child: Container(
                                constraints: BoxConstraints(
                                  maxWidth: MediaQuery.of(context).size.width * 0.75,
                                ),
                                margin: const EdgeInsets.symmetric(vertical: 4),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  gradient: isUser
                                      ? const LinearGradient(
                                          colors: [CgColors.primary, Color(0xFFF43F5E)],
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                        )
                                      : null,
                                  color: isUser
                                      ? null
                                      : (isDark ? const Color(0xFF1E2530) : Colors.white),
                                  borderRadius: BorderRadius.only(
                                    topLeft: isUser ? const Radius.circular(CgRadius.md) : Radius.zero,
                                    topRight: isUser ? Radius.zero : const Radius.circular(CgRadius.md),
                                    bottomLeft: const Radius.circular(CgRadius.md),
                                    bottomRight: const Radius.circular(CgRadius.md),
                                  ),
                                  border: isUser
                                      ? null
                                      : Border.all(
                                          color: isDark
                                              ? Colors.white.withValues(alpha: 0.05)
                                              : Colors.black.withValues(alpha: 0.05),
                                        ),
                                ),
                                child: Column(
                                  crossAxisAlignment:
                                      isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      text,
                                      style: textTheme.bodyMedium?.copyWith(
                                        color: isUser ? Colors.white : textColor,
                                      ),
                                    ),
                                    if (time.isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        time,
                                        style: textTheme.bodySmall?.copyWith(
                                          fontSize: 9,
                                          color: isUser ? Colors.white70 : subtitleColor,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cardBg,
                border: Border(
                  top: BorderSide(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.08)
                        : Colors.black.withValues(alpha: 0.08),
                  ),
                ),
              ),
              child: SafeArea(
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _messageController,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: InputDecoration(
                          hintText: 'Nhập câu hỏi sức khỏe...',
                          hintStyle: textTheme.bodyMedium?.copyWith(color: subtitleColor),
                          fillColor: isDark ? const Color(0xFF0F131A) : const Color(0xFFF1F3F6),
                          filled: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(24),
                            borderSide: BorderSide.none,
                          ),
                        ),
                        style: textTheme.bodyMedium?.copyWith(color: textColor),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [CgColors.primary, Color(0xFFF43F5E)],
                        ),
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        icon: const Icon(LucideIcons.send, color: Colors.white, size: 18),
                        onPressed: chatProvider.isLoading
                            ? null
                            : () => _handleSendMessage(chatProvider, role),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    // Sessions List View
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Trợ lý AI Y Tế',
          style: textTheme.titleLarge?.copyWith(fontSize: 20, color: textColor),
        ),
        elevation: 0,
        backgroundColor: isDark ? const Color(0xFF07080A) : const Color(0xFFF4F6FA),
      ),
      body: Column(
        children: [
          // Banner introducing AI features
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [CgColors.primary, Color(0xFFF43F5E)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(CgRadius.lg),
                boxShadow: [
                  BoxShadow(
                    color: CgColors.primary.withValues(alpha: 0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Tư vấn Sức khỏe Thông minh',
                          style: textTheme.titleMedium?.copyWith(color: Colors.white, fontSize: 16),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Hỏi đáp các chỉ số tim mạch, lời khuyên y tế tức thời được hỗ trợ bởi trí tuệ nhân tạo.',
                          style: textTheme.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.9), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(LucideIcons.sparkles, color: Colors.white, size: 28),
                  ),
                ],
              ),
            ),
          ),
          
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Lịch sử trò chuyện',
                  style: textTheme.titleMedium?.copyWith(color: textColor),
                ),
                TextButton.icon(
                  onPressed: () {
                    chatProvider.clearAiMessages();
                    // Send an empty context message or trigger new chat session screen
                    // In this API implementation, sending message without session creates one
                    setState(() {
                      chatProvider.clearAiMessages();
                      chatProvider.sendAiMessage(messageText: "Xin chào Trợ lý AI!", role: role);
                    });
                  },
                  icon: const Icon(LucideIcons.plus, size: 16, color: CgColors.primary),
                  label: Text(
                    'Chat mới',
                    style: textTheme.bodySmall?.copyWith(color: CgColors.primary, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: chatProvider.isLoading && chatProvider.aiSessions.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : chatProvider.aiSessions.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(LucideIcons.messageSquare, size: 48, color: subtitleColor),
                            const SizedBox(height: 12),
                            Text(
                              'Không có lịch sử trò chuyện nào.',
                              style: textTheme.bodyMedium?.copyWith(color: subtitleColor),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () => chatProvider.fetchAiSessions(role),
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: chatProvider.aiSessions.length,
                          itemBuilder: (context, index) {
                            final session = chatProvider.aiSessions[index];
                            final sessionId = session.id;
                            final title = session.title;
                            final time = _formatTime(session.createdAt.toIso8601String());

                            return Padding(
                              padding: const EdgeInsets.only(bottom: 8.0),
                              child: CgCard(
                                padding: EdgeInsets.zero,
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(CgRadius.md),
                                  onTap: () {
                                    chatProvider.fetchAiChatHistory(sessionId);
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.all(16.0),
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            color: CgColors.primary.withValues(alpha: 0.08),
                                            shape: BoxShape.circle,
                                          ),
                                          child: const Icon(LucideIcons.bot, color: CgColors.primary, size: 20),
                                        ),
                                        const SizedBox(width: 14),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                title,
                                                style: textTheme.titleMedium?.copyWith(fontSize: 14, color: textColor),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                time,
                                                style: textTheme.bodySmall?.copyWith(color: subtitleColor),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Icon(LucideIcons.chevronRight, size: 18, color: subtitleColor),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
