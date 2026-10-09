/// User model
class UserModel {
  final String id;
  final String email;
  final String role;
  final DateTime? createdAt;
  final DateTime? lastLoginAt;

  const UserModel({
    required this.id,
    required this.email,
    required this.role,
    this.createdAt,
    this.lastLoginAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
      lastLoginAt: json['lastLoginAt'] != null
          ? DateTime.tryParse(json['lastLoginAt'] as String)
          : null,
    );
  }

  bool get isAdmin => role == 'ADMIN';

  UserModel copyWith({String? id, String? email, String? role}) {
    return UserModel(
      id: id ?? this.id,
      email: email ?? this.email,
      role: role ?? this.role,
      createdAt: createdAt,
      lastLoginAt: lastLoginAt,
    );
  }
}

/// File model — encryption internals are never included
class FileModel {
  final String id;
  final String originalFilename;
  final String mimeType;
  final int size;
  final DateTime createdAt;

  const FileModel({
    required this.id,
    required this.originalFilename,
    required this.mimeType,
    required this.size,
    required this.createdAt,
  });

  factory FileModel.fromJson(Map<String, dynamic> json) {
    return FileModel(
      id: (json['id'] ?? json['_id']) as String,
      originalFilename: json['originalFilename'] as String,
      mimeType: json['mimeType'] as String,
      size: json['size'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  String get fileIcon {
    if (mimeType == 'application/pdf') return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    return '📁';
  }

  String get sizeFormatted {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

/// Auth state
sealed class AuthState {
  const AuthState();
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  final UserModel user;
  final String accessToken;
  const AuthAuthenticated({required this.user, required this.accessToken});
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthError extends AuthState {
  final String message;
  const AuthError(this.message);
}
