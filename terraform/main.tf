terraform {
  required_version = ">= 1.0"

  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = "~> 0.100"
    }
  }
}

provider "yandex" {
  zone = "ru-central1-a"
}

# Локальные переменные для зон
locals {
  zones    = ["ru-central1-a", "ru-central1-b", "ru-central1-d"]
  vm_count = 3
}

# Создание VPC сети
resource "yandex_vpc_network" "network" {
  name   = "quiz-backend-network"
  labels = {}
}

# Создание подсетей в трёх зонах
resource "yandex_vpc_subnet" "subnets" {
  count          = 3
  name           = "quiz-backend-network-subnet-${local.zones[count.index]}"
  zone           = local.zones[count.index]
  network_id     = yandex_vpc_network.network.id
  v4_cidr_blocks = [["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"][count.index]]

  labels = {}
}

# Группа безопасности для виртуальных машин
resource "yandex_vpc_security_group" "vm_security_group" {
  name        = "quiz-backend-vm-sg"
  description = "Группа безопасности для виртуальных машин quiz-backend"
  network_id  = yandex_vpc_network.network.id

  # Разрешаем входящий HTTP трафик (порт 80)
  ingress {
    protocol       = "TCP"
    description    = "HTTP"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 80
  }

  # Разрешаем входящий HTTPS трафик (порт 443)
  ingress {
    protocol       = "TCP"
    description    = "HTTPS"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 443
  }

  # Разрешаем входящий SSH трафик (порт 22) для администрирования
  ingress {
    protocol       = "TCP"
    description    = "SSH"
    v4_cidr_blocks = ["0.0.0.0/0"]
    port           = 22
  }

  # Разрешаем внутренний трафик между машинами в сети
  ingress {
    protocol       = "ANY"
    description    = "Внутренний трафик между машинами"
    v4_cidr_blocks = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  }

  # Разрешаем весь исходящий трафик
  egress {
    protocol       = "ANY"
    description    = "Исходящий трафик"
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  labels = {}
}

# Создание 3 виртуальных машин в разных зонах
resource "yandex_compute_instance" "vm" {
  count       = local.vm_count
  name        = "quiz-backend-vm-${count.index + 1}"
  platform_id = "standard-v2"
  zone        = local.zones[count.index]

  resources {
    cores  = 2
    memory = 4
  }

  boot_disk {
    initialize_params {
      image_id = var.image_id
      size     = 20
      type     = "network-ssd"
    }
  }

  network_interface {
    subnet_id          = yandex_vpc_subnet.subnets[count.index].id
    nat                = true
    security_group_ids = [yandex_vpc_security_group.vm_security_group.id]
  }

  metadata = {
    ssh-keys  = null
    user-data = <<-EOF
      #cloud-config
      write_files:
        - path: ${var.env_file_path}
          owner: root:root
          permissions: '0600'
          content: |
            ${join("\n            ", [for key, value in var.env_vars : "${key}=${value}"])}
      runcmd:
        - mkdir -p /svr/quiz-backend
        - chmod 777 ${var.env_file_path}
      EOF
  }

  labels = {
    instance_index = count.index + 1
    zone           = local.zones[count.index]
  }
}

# Целевая группа для балансировщика
resource "yandex_alb_target_group" "target_group" {
  name = "quiz-backend-vm-tg"

  dynamic "target" {
    for_each = yandex_compute_instance.vm
    content {
      subnet_id  = target.value.network_interface[0].subnet_id
      ip_address = target.value.network_interface[0].ip_address
    }
  }

  labels = {}
}

# HTTP роутер для балансировщика
resource "yandex_alb_http_router" "http_router" {
  name = "quiz-backend-vm-http-router"

  labels = {}
}

# Виртуальный хост для балансировщика
resource "yandex_alb_virtual_host" "virtual_host" {
  name           = "quiz-backend-vm-virtual-host"
  http_router_id = yandex_alb_http_router.http_router.id

  route {
    name = "default-route"
    http_route {
      http_route_action {
        backend_group_id = yandex_alb_backend_group.backend_group.id
        timeout          = "60s"
      }
    }
  }
}

# Группа бэкендов для балансировщика
resource "yandex_alb_backend_group" "backend_group" {
  name = "quiz-backend-vm-backend-group"

  http_backend {
    name             = "quiz-backend-vm-backend"
    weight           = 1
    port             = var.lb_backend_port
    target_group_ids = [yandex_alb_target_group.target_group.id]

    load_balancing_config {
      panic_threshold                = 50
      locality_aware_routing_percent = 0
      strict_locality                = false
    }

    healthcheck {
      timeout             = "5s"
      interval            = "10s"
      healthy_threshold   = 2
      unhealthy_threshold = 2

      http_healthcheck {
        path = "/api/health" # Используем специальный health endpoint, который возвращает 200
      }
    }
  }

  labels = {}
}

# Application Load Balancer
resource "yandex_alb_load_balancer" "load_balancer" {
  name       = "quiz-backend-vm-alb"
  network_id = yandex_vpc_network.network.id

  allocation_policy {
    location {
      zone_id   = "ru-central1-a"
      subnet_id = yandex_vpc_subnet.subnets[0].id
    }
    location {
      zone_id   = "ru-central1-b"
      subnet_id = yandex_vpc_subnet.subnets[1].id
    }
    location {
      zone_id   = "ru-central1-d"
      subnet_id = yandex_vpc_subnet.subnets[2].id
    }
  }

  listener {
    name = "quiz-backend-vm-listener"
    endpoint {
      address {
        external_ipv4_address {
        }
      }
      ports = [var.lb_listener_port]
    }
    http {
      handler {
        http_router_id = yandex_alb_http_router.http_router.id
      }
    }
  }

  labels = {}
}

