import sys
from werkzeug.security import generate_password_hash


def principal():
    if len(sys.argv) != 2:
        print("uso: python scripts/gerar_hash_senha.py <senha>")
        return
    print(generate_password_hash(sys.argv[1]))


if __name__ == "__main__":
    principal()
