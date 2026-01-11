variable "image_id" {
  description = "ID образа диска для виртуальной машины"
  type        = string
}

variable "lb_listener_port" {
  description = "Порт, на котором балансировщик принимает трафик"
  type        = number
  default     = 80
}

variable "lb_backend_port" {
  description = "Порт на машинах"
  type        = number
  default     = 8000
}

variable "env_vars" {
  description = "Переменные окружения для .env файла"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "env_file_path" {
  description = "Путь к файлу .env на сервере"
  type        = string
  default     = "/svr/quiz-backend/.env"
}
